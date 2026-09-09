-- Phase 7 corrective hardening: use direct ownership predicates in RLS instead
-- of an exposed SECURITY DEFINER helper. This removes the RPC surface entirely.
create or replace function public.phase7_validate_feedback_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.match_evaluation_id is not null and not exists (
    select 1 from public.match_evaluations where id = new.match_evaluation_id and user_id = new.user_id
  ) then
    raise exception 'Feedback must belong to the match owner';
  end if;
  return new;
end;
$$;

drop policy if exists phase7_country_rules_select_own on public.match_country_rule_versions;
drop policy if exists phase7_requirements_select_own on public.match_requirement_results;
drop policy if exists phase7_scores_select_own on public.match_score_components;
drop policy if exists phase7_readiness_select_own on public.match_readiness_items;
drop policy if exists phase7_reasons_select_own on public.match_reasons;
drop policy if exists phase7_actions_select_own on public.match_next_actions;
drop policy if exists phase7_actions_update_own on public.match_next_actions;

create policy phase7_country_rules_select_own on public.match_country_rule_versions for select to authenticated using (
  exists (select 1 from public.match_evaluations where id = match_evaluation_id and user_id = auth.uid())
);
create policy phase7_requirements_select_own on public.match_requirement_results for select to authenticated using (
  exists (select 1 from public.match_evaluations where id = match_evaluation_id and user_id = auth.uid())
);
create policy phase7_scores_select_own on public.match_score_components for select to authenticated using (
  exists (select 1 from public.match_evaluations where id = match_evaluation_id and user_id = auth.uid())
);
create policy phase7_readiness_select_own on public.match_readiness_items for select to authenticated using (
  exists (select 1 from public.match_evaluations where id = match_evaluation_id and user_id = auth.uid())
);
create policy phase7_reasons_select_own on public.match_reasons for select to authenticated using (
  exists (select 1 from public.match_evaluations where id = match_evaluation_id and user_id = auth.uid())
);
create policy phase7_actions_select_own on public.match_next_actions for select to authenticated using (
  exists (select 1 from public.match_evaluations where id = match_evaluation_id and user_id = auth.uid())
);
create policy phase7_actions_update_own on public.match_next_actions for update to authenticated using (
  exists (select 1 from public.match_evaluations where id = match_evaluation_id and user_id = auth.uid())
) with check (
  exists (select 1 from public.match_evaluations where id = match_evaluation_id and user_id = auth.uid())
);

drop function public.phase7_match_owner(uuid);
