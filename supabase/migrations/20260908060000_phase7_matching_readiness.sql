-- WAYFOUND Phase 7: deterministic, append-oriented matching and readiness.
-- Match execution is server-only. Users may read only their own results and may
-- acknowledge/dismiss their own next actions or submit bounded feedback events.

create table public.match_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_version_id uuid not null references public.profile_versions(id) on delete restrict,
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  opportunity_version_id uuid not null references public.opportunity_versions(id) on delete restrict,
  confidence_assessment_id uuid references public.confidence_assessments(id) on delete restrict,
  algorithm_version text not null,
  scoring_configuration_version text not null,
  input_fingerprint text not null,
  candidate_rank integer not null,
  eligibility_outcome text not null,
  publication_decision text not null,
  match_score smallint not null,
  readiness_state text not null,
  selection_factors jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  constraint phase7_match_rank check (candidate_rank between 1 and 500),
  constraint phase7_match_outcome check (eligibility_outcome in ('eligible', 'not_currently_eligible', 'more_information_needed', 'manual_confirmation_required', 'not_actionable')),
  constraint phase7_match_decision check (publication_decision in ('allow', 'limited', 'more_evidence', 'suppress', 'inaccessible', 'expired', 'withdrawn', 'recheck')),
  constraint phase7_match_score check (match_score between 0 and 100),
  constraint phase7_match_readiness check (readiness_state in ('ready', 'missing', 'in_progress', 'expired', 'unknown', 'conditional', 'not_applicable')),
  constraint phase7_match_selection_object check (jsonb_typeof(selection_factors) = 'object'),
  constraint phase7_match_fingerprint_unique unique (user_id, algorithm_version, scoring_configuration_version, input_fingerprint)
);

create table public.match_country_rule_versions (
  id uuid primary key default gen_random_uuid(),
  match_evaluation_id uuid not null references public.match_evaluations(id) on delete cascade,
  country_rule_id uuid not null references public.country_rules(id) on delete restrict,
  rule_version integer not null,
  constraint phase7_country_rule_version check (rule_version > 0),
  constraint phase7_match_country_rule_unique unique (match_evaluation_id, country_rule_id, rule_version)
);

create table public.match_requirement_results (
  id uuid primary key default gen_random_uuid(),
  match_evaluation_id uuid not null references public.match_evaluations(id) on delete cascade,
  opportunity_requirement_id uuid references public.opportunity_requirements(id) on delete restrict,
  requirement_category text not null,
  operator text not null,
  requirement_strength text not null,
  outcome text not null,
  evidence_id uuid references public.opportunity_evidence(id) on delete restrict,
  explanation text not null,
  value_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint phase7_requirement_operator check (operator in ('equals', 'not_equals', 'in_list', 'not_in_list', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between', 'contains_any', 'contains_all', 'exists', 'not_required')),
  constraint phase7_requirement_strength check (requirement_strength in ('hard', 'soft', 'informational')),
  constraint phase7_requirement_outcome check (outcome in ('met', 'not_met', 'unknown', 'not_applicable', 'conflicting', 'manual_confirmation_required')),
  constraint phase7_requirement_explanation check (char_length(explanation) between 1 and 500),
  constraint phase7_requirement_value_object check (jsonb_typeof(value_state) = 'object'),
  constraint phase7_match_requirement_unique unique (match_evaluation_id, opportunity_requirement_id)
);

create table public.match_score_components (
  id uuid primary key default gen_random_uuid(),
  match_evaluation_id uuid not null references public.match_evaluations(id) on delete cascade,
  component_code text not null,
  weight smallint not null,
  score smallint not null,
  contribution smallint not null,
  explanation text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint phase7_score_component_code check (component_code in ('soft_requirements', 'goal_alignment', 'destination_alignment', 'study_or_occupation_alignment', 'sponsorship_clarity', 'readiness')),
  constraint phase7_score_component_weight check (weight between 0 and 100),
  constraint phase7_score_component_score check (score between 0 and 100),
  constraint phase7_score_component_contribution check (contribution between 0 and 100),
  constraint phase7_score_component_explanation check (char_length(explanation) between 1 and 500),
  constraint phase7_score_component_unique unique (match_evaluation_id, component_code)
);

create table public.match_readiness_items (
  id uuid primary key default gen_random_uuid(),
  match_evaluation_id uuid not null references public.match_evaluations(id) on delete cascade,
  item_key text not null,
  document_type text,
  state text not null,
  requirement_id uuid references public.opportunity_requirements(id) on delete restrict,
  evidence_id uuid references public.opportunity_evidence(id) on delete restrict,
  explanation text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint phase7_readiness_state check (state in ('ready', 'missing', 'in_progress', 'expired', 'unknown', 'conditional', 'not_applicable')),
  constraint phase7_readiness_explanation check (char_length(explanation) between 1 and 500),
  constraint phase7_readiness_item_unique unique (match_evaluation_id, item_key)
);

create table public.match_reasons (
  id uuid primary key default gen_random_uuid(),
  match_evaluation_id uuid not null references public.match_evaluations(id) on delete cascade,
  reason_type text not null,
  sort_order smallint not null,
  requirement_id uuid references public.opportunity_requirements(id) on delete restrict,
  evidence_id uuid references public.opportunity_evidence(id) on delete restrict,
  message text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint phase7_reason_type check (reason_type in ('hard_disqualifier', 'gap', 'match_factor', 'limitation', 'sponsorship', 'safety', 'readiness')),
  constraint phase7_reason_order check (sort_order between 1 and 100),
  constraint phase7_reason_message check (char_length(message) between 1 and 500),
  constraint phase7_reason_unique unique (match_evaluation_id, sort_order)
);

create table public.match_next_actions (
  id uuid primary key default gen_random_uuid(),
  match_evaluation_id uuid not null references public.match_evaluations(id) on delete cascade,
  action_type text not null,
  priority smallint not null,
  status text not null default 'pending',
  source_reason_id uuid references public.match_reasons(id) on delete restrict,
  title text not null,
  explanation text not null,
  due_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint phase7_action_type check (action_type in ('complete_passport_field', 'obtain_document', 'update_document', 'confirm_qualification', 'provide_language_information', 'review_hard_requirement', 'verify_sponsorship_wording', 'apply_before_deadline', 'skip_non_actionable')),
  constraint phase7_action_priority check (priority between 1 and 100),
  constraint phase7_action_status check (status in ('pending', 'acknowledged', 'completed', 'dismissed')),
  constraint phase7_action_title check (char_length(title) between 1 and 160),
  constraint phase7_action_explanation check (char_length(explanation) between 1 and 500),
  constraint phase7_action_unique unique (match_evaluation_id, action_type)
);

create table public.match_feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_evaluation_id uuid references public.match_evaluations(id) on delete cascade,
  event_type text not null,
  idempotency_key uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint phase7_feedback_type check (event_type in ('match_viewed', 'match_useful', 'match_not_useful', 'match_saved', 'match_unsaved', 'match_dismissed', 'reason_selected', 'missing_information_supplied', 'next_action_acknowledged', 'next_action_completed', 'application_intent')),
  constraint phase7_feedback_metadata check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096),
  constraint phase7_feedback_idempotency unique (user_id, idempotency_key)
);

create index phase7_match_user_rank_idx on public.match_evaluations(user_id, eligibility_outcome, match_score desc, candidate_rank, evaluated_at desc);
create index phase7_match_opportunity_idx on public.match_evaluations(opportunity_id, evaluated_at desc);
create index phase7_requirement_match_idx on public.match_requirement_results(match_evaluation_id, outcome);
create index phase7_readiness_match_idx on public.match_readiness_items(match_evaluation_id, state);
create index phase7_actions_match_idx on public.match_next_actions(match_evaluation_id, priority);
create index phase7_feedback_user_idx on public.match_feedback_events(user_id, created_at desc);

create or replace function public.phase7_match_owner(match_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.match_evaluations where id = match_id;
$$;
revoke all on function public.phase7_match_owner(uuid) from public;
grant execute on function public.phase7_match_owner(uuid) to authenticated;

create or replace function public.phase7_reject_match_history_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Phase 7 match history is immutable';
end;
$$;

create or replace function public.phase7_guard_next_action_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.id <> old.id or new.match_evaluation_id <> old.match_evaluation_id or new.action_type <> old.action_type
    or new.priority <> old.priority or new.source_reason_id is distinct from old.source_reason_id
    or new.title <> old.title or new.explanation <> old.explanation or new.due_at is distinct from old.due_at
    or new.created_at <> old.created_at then
    raise exception 'Only next-action status may be changed by a user';
  end if;
  if new.status not in ('pending', 'acknowledged', 'completed', 'dismissed') then
    raise exception 'Invalid next-action status';
  end if;
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.phase7_validate_feedback_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.match_evaluation_id is not null and public.phase7_match_owner(new.match_evaluation_id) <> new.user_id then
    raise exception 'Feedback must belong to the match owner';
  end if;
  return new;
end;
$$;

create or replace function public.phase7_validate_match_references()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.profile_versions where id = new.profile_version_id and user_id = new.user_id) then
    raise exception 'Match must reference a Passport version owned by its user';
  end if;
  if not exists (select 1 from public.opportunity_versions where id = new.opportunity_version_id and opportunity_id = new.opportunity_id) then
    raise exception 'Match opportunity version does not belong to the opportunity';
  end if;
  if new.confidence_assessment_id is not null and not exists (select 1 from public.confidence_assessments where id = new.confidence_assessment_id and opportunity_id = new.opportunity_id) then
    raise exception 'Confidence assessment does not belong to the opportunity';
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['match_evaluations', 'match_country_rule_versions', 'match_requirement_results', 'match_score_components', 'match_readiness_items', 'match_reasons'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('create trigger phase7_%I_immutable before update or delete on public.%I for each row execute function public.phase7_reject_match_history_mutation()', table_name, table_name);
  end loop;
end $$;

alter table public.match_next_actions enable row level security;
alter table public.match_feedback_events enable row level security;
revoke all on public.match_next_actions, public.match_feedback_events from anon, authenticated;

create policy phase7_matches_select_own on public.match_evaluations for select to authenticated using (user_id = auth.uid());
create policy phase7_country_rules_select_own on public.match_country_rule_versions for select to authenticated using (public.phase7_match_owner(match_evaluation_id) = auth.uid());
create policy phase7_requirements_select_own on public.match_requirement_results for select to authenticated using (public.phase7_match_owner(match_evaluation_id) = auth.uid());
create policy phase7_scores_select_own on public.match_score_components for select to authenticated using (public.phase7_match_owner(match_evaluation_id) = auth.uid());
create policy phase7_readiness_select_own on public.match_readiness_items for select to authenticated using (public.phase7_match_owner(match_evaluation_id) = auth.uid());
create policy phase7_reasons_select_own on public.match_reasons for select to authenticated using (public.phase7_match_owner(match_evaluation_id) = auth.uid());
create policy phase7_actions_select_own on public.match_next_actions for select to authenticated using (public.phase7_match_owner(match_evaluation_id) = auth.uid());
create policy phase7_actions_update_own on public.match_next_actions for update to authenticated using (public.phase7_match_owner(match_evaluation_id) = auth.uid()) with check (public.phase7_match_owner(match_evaluation_id) = auth.uid());
create policy phase7_feedback_select_own on public.match_feedback_events for select to authenticated using (user_id = auth.uid());
create policy phase7_feedback_insert_own on public.match_feedback_events for insert to authenticated with check (user_id = auth.uid());

grant select on public.match_evaluations, public.match_country_rule_versions, public.match_requirement_results, public.match_score_components, public.match_readiness_items, public.match_reasons to authenticated;
grant select, update on public.match_next_actions to authenticated;
grant select, insert on public.match_feedback_events to authenticated;

create trigger phase7_next_actions_guard before update on public.match_next_actions for each row execute function public.phase7_guard_next_action_update();
create trigger phase7_feedback_owner before insert on public.match_feedback_events for each row execute function public.phase7_validate_feedback_owner();
create trigger phase7_match_references before insert on public.match_evaluations for each row execute function public.phase7_validate_match_references();

comment on table public.match_evaluations is 'Server-created, immutable deterministic match outcomes. Score is fit only, never a success, admission or visa probability.';
comment on table public.match_requirement_results is 'Versioned requirement outcomes; unknown is distinct from not_met.';
comment on table public.match_readiness_items is 'Readiness is documentary preparation only and never asserts official document validity.';
comment on table public.match_feedback_events is 'Private, bounded UX feedback. It never changes match eligibility or scoring.';
