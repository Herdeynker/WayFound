-- Phase 9 corrective migration: preserve deterministic checklist ordering.
-- opportunity_documents has no sort_order; stable UUID ordering provides a repeatable fallback.

create or replace function public.phase9_create_application_workspace(candidate_match_id uuid, request_key uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare current_user_id uuid := auth.uid(); result_id uuid; candidate_opportunity_id uuid; official_due date;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  select me.opportunity_id into candidate_opportunity_id from public.match_evaluations me where me.id = candidate_match_id and me.user_id = current_user_id;
  if candidate_opportunity_id is null or not exists (select 1 from public.safe_active_opportunities where id = candidate_opportunity_id) then raise exception 'safe owned match required'; end if;
  select application_deadline into official_due from public.safe_active_opportunities where id = candidate_opportunity_id;
  insert into public.applications (user_id, opportunity_id, match_evaluation_id, official_deadline) values (current_user_id, candidate_opportunity_id, candidate_match_id, official_due)
    on conflict (user_id, opportunity_id) do update set updated_at = public.applications.updated_at returning id into result_id;
  insert into public.application_status_events (application_id, user_id, from_status, to_status, note, idempotency_key)
    select result_id, current_user_id, null, 'interested', 'Workspace created from a saved match.', request_key
    where not exists (select 1 from public.application_status_events where application_id = result_id and from_status is null and to_status = 'interested')
    on conflict (application_id, idempotency_key) do nothing;
  insert into public.application_checklist_items (application_id, opportunity_document_id, document_type, title, requirement_state, explanation, sort_order, due_at)
    select result_id, od.id, od.document_type, coalesce(nullif(od.original_wording,''), od.document_type), od.requirement_status, od.notes,
      (row_number() over (order by od.id) - 1)::smallint, od.deadline_at
    from public.opportunity_documents od where od.opportunity_id = candidate_opportunity_id
    on conflict (application_id, opportunity_document_id) do nothing;
  return result_id;
end;
$$;
