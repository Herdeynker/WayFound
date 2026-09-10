-- Phase 10 forward-only hardening: make every server-written ownership chain
-- self-validating even when a trusted service performs the write.

create or replace function public.phase10_validate_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
declare owning_application uuid; owning_user uuid; owning_opportunity uuid;
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
    owning_application := new.application_id;
    owning_user := new.user_id;
  end if;
  if owning_user is null or owning_user <> new.user_id or not public.phase10_application_owned(owning_application, new.user_id) then
    raise exception 'phase10 owner must match the application owner';
  end if;
  if tg_table_name in ('assistant_fact_sets','assistant_drafts') then
    select opportunity_id into owning_opportunity from public.applications where id = new.application_id and user_id = new.user_id;
    if owning_opportunity is null or owning_opportunity <> new.opportunity_id then
      raise exception 'phase10 opportunity must match the owned application';
    end if;
  end if;
  if tg_table_name = 'assistant_drafts' and not exists (
    select 1 from public.assistant_fact_sets f where f.id = new.fact_set_id
      and f.user_id = new.user_id and f.application_id = new.application_id and f.opportunity_id = new.opportunity_id
  ) then raise exception 'draft fact set must match its owner and application'; end if;
  return new;
end;
$$;

create trigger phase10_usage_owner before insert or update on public.assistant_usage_ledger
  for each row execute function public.phase10_validate_ownership();

revoke all on function public.phase10_validate_ownership() from public, anon, authenticated;

