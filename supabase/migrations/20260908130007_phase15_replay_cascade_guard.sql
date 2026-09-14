-- Phase 15 corrective follow-up. Preserve the Phase 9 parent-cascade guard
-- while retaining the Phase 15 operational timestamp replay guard.

create or replace function public.phase4_capture_related_opportunity_version()
returns trigger language plpgsql set search_path = public as $$
declare
  related_opportunity_id uuid;
  related_snapshot jsonb;
begin
  if tg_op = 'UPDATE'
    and (to_jsonb(old) - array['last_seen_at', 'updated_at']::text[])
      = (to_jsonb(new) - array['last_seen_at', 'updated_at']::text[]) then
    return new;
  end if;

  if tg_op = 'DELETE' then
    related_opportunity_id := old.opportunity_id;
    related_snapshot := to_jsonb(old);
  else
    related_opportunity_id := new.opportunity_id;
    related_snapshot := to_jsonb(new);
  end if;
  if related_opportunity_id is not null
    and exists (select 1 from public.opportunities where id = related_opportunity_id)
  then
    insert into public.opportunity_versions (opportunity_id, version_number, reason, schema_version, snapshot)
    values (
      related_opportunity_id,
      coalesce((select max(version_number) + 1 from public.opportunity_versions where opportunity_id = related_opportunity_id), 1),
      case when tg_table_name = 'sponsorship_evidence' then 'source_evidence_change' else 'material_change' end,
      'phase4.v1',
      jsonb_build_object('related_table', tg_table_name, 'operation', tg_op, 'record', related_snapshot)
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

comment on function public.phase4_capture_related_opportunity_version() is
  'Captures material related-record history, ignores operational timestamp-only refreshes, and skips parent-cascade deletion.';
