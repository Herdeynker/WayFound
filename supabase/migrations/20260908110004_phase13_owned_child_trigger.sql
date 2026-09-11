-- Phase 13 forward-only correction: this shared trigger runs on child tables
-- with different record shapes, so optional columns must be read generically.

create or replace function public.phase13_validate_owned_child()
returns trigger language plpgsql set search_path = public as $$
declare
  attempt_owner uuid;
  attempt_skill text;
  candidate_attempt_id uuid;
  candidate_skill text;
begin
  candidate_attempt_id := case when tg_table_name = 'ielts_study_plans'
    then (to_jsonb(new)->>'source_attempt_id')::uuid
    else (to_jsonb(new)->>'attempt_id')::uuid end;
  candidate_skill := to_jsonb(new)->>'skill';

  select user_id, skill into attempt_owner, attempt_skill
  from public.ielts_attempts
  where id = candidate_attempt_id;

  if attempt_owner is null or attempt_owner <> new.user_id then
    raise exception 'IELTS attempt owner mismatch';
  end if;
  if tg_table_name = 'ielts_feedback' and attempt_skill <> candidate_skill then
    raise exception 'IELTS feedback skill mismatch';
  end if;
  if tg_table_name = 'ielts_speaking_recordings' then
    if attempt_skill <> 'speaking' then
      raise exception 'recording requires a speaking attempt';
    end if;
    if not exists (
      select 1
      from public.document_versions v
      join public.document_metadata d on d.id = v.document_id
      where v.id = new.document_version_id
        and v.document_id = new.document_id
        and v.user_id = new.user_id
        and d.user_id = new.user_id
    ) then
      raise exception 'recording document owner mismatch';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.phase13_validate_owned_child() from public, anon, authenticated;
