-- Phase 10 forward-only trigger repair. Access draft-only fields through JSON so
-- the shared trigger remains valid for every table record shape.

create or replace function public.phase10_validate_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
declare owning_application uuid; owning_user uuid; owning_opportunity uuid; candidate_fact_set uuid;
begin
  if tg_table_name = 'cv_analysis_findings' then
    select application_id, user_id into owning_application, owning_user from public.cv_analyses where id = new.analysis_id;
  elsif tg_table_name = 'assistant_source_facts' then
    select application_id, user_id into owning_application, owning_user from public.assistant_fact_sets where id = new.fact_set_id;
  elsif tg_table_name = 'assistant_generation_requests' then
    select application_id, user_id into owning_application, owning_user from public.assistant_drafts where id = new.draft_id;
  elsif tg_table_name = 'assistant_draft_revisions' then
    select d.application_id, d.user_id into owning_application, owning_user
      from public.assistant_drafts d
      join public.assistant_generation_requests r on r.id = new.generation_request_id
      where d.id = new.draft_id and r.draft_id = d.id and r.user_id = d.user_id;
  elsif tg_table_name = 'assistant_exports' then
    select d.application_id, d.user_id into owning_application, owning_user
      from public.assistant_drafts d
      join public.assistant_draft_revisions r on r.id = new.revision_id
      where d.id = new.draft_id and r.draft_id = d.id and r.user_id = d.user_id;
  elsif tg_table_name = 'assistant_usage_ledger' then
    select d.application_id, r.user_id into owning_application, owning_user
      from public.assistant_generation_requests r
      join public.assistant_drafts d on d.id = r.draft_id
      where r.id = new.generation_request_id and d.user_id = r.user_id;
  else
    owning_application := (to_jsonb(new)->>'application_id')::uuid;
    owning_user := new.user_id;
  end if;
  if owning_user is null or owning_user <> new.user_id or not public.phase10_application_owned(owning_application, new.user_id) then
    raise exception 'phase10 owner must match the application owner';
  end if;
  if tg_table_name in ('assistant_fact_sets','assistant_drafts') then
    select opportunity_id into owning_opportunity from public.applications where id = owning_application and user_id = new.user_id;
    if owning_opportunity is null or owning_opportunity <> (to_jsonb(new)->>'opportunity_id')::uuid then
      raise exception 'phase10 opportunity must match the owned application';
    end if;
  end if;
  if tg_table_name = 'assistant_drafts' then
    candidate_fact_set := (to_jsonb(new)->>'fact_set_id')::uuid;
    if not exists (
      select 1 from public.assistant_fact_sets f where f.id = candidate_fact_set
        and f.user_id = new.user_id and f.application_id = owning_application and f.opportunity_id = owning_opportunity
    ) then raise exception 'draft fact set must match its owner and application'; end if;
  end if;
  return new;
end;
$$;

revoke all on function public.phase10_validate_ownership() from public, anon, authenticated;

