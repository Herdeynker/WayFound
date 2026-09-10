-- Phase 9 regression repair: related-row DELETE triggers must not append a
-- version after their parent opportunity has entered a cascade delete.

create or replace function public.phase4_capture_related_opportunity_version()
returns trigger language plpgsql set search_path = public as $$
declare
  related_opportunity_id uuid;
  related_snapshot jsonb;
begin
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
  'Appends related material history while skipping parent-cascade deletion, allowing deterministic fixture and account cleanup.';
