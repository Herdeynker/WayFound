-- WAYFOUND corrective onboarding optimization.
-- Keeps the Phase 3 normalized Passport model while adding a stable four-stage
-- draft version and one transactional, owner-bound confirmation boundary.

alter table public.onboarding_progress
  add column if not exists flow_version text not null default 'phase3.v1',
  add column if not exists passport_readiness integer not null default 0,
  add column if not exists onboarding_started_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.onboarding_progress
  drop constraint if exists onboarding_passport_readiness_check,
  add constraint onboarding_passport_readiness_check check (passport_readiness between 0 and 100),
  drop constraint if exists onboarding_flow_version_check,
  add constraint onboarding_flow_version_check check (flow_version in ('phase3.v1', 'onboarding.optimized.v1'));

alter table public.profile_versions
  add column if not exists snapshot_fingerprint text;

-- An unknown expiry is valid during concise onboarding. It remains distinct from
-- an explicit no-expiry assertion and can be enriched later.
alter table public.certifications drop constraint if exists certification_expiry;
alter table public.certifications drop constraint if exists certification_date_order;
alter table public.certifications add constraint certification_date_order check (
  expiry_date is null or issue_date is null or expiry_date >= issue_date
);

update public.profile_versions pv
set snapshot_fingerprint = encode(extensions.digest(pv.snapshot::text, 'sha256'), 'hex')
where pv.snapshot_fingerprint is null;

create index if not exists profile_versions_owner_fingerprint_idx
  on public.profile_versions (user_id, snapshot_fingerprint, version_number desc)
  where snapshot_fingerprint is not null;

create or replace function public.onboarding_parse_partial_date(candidate text)
returns date
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when nullif(candidate, '') is null then null
    when candidate ~ '^\d{4}$' then make_date(candidate::integer, 1, 1)
    when candidate ~ '^\d{4}-\d{2}$' then
      make_date(split_part(candidate, '-', 1)::integer, split_part(candidate, '-', 2)::integer, 1)
    else candidate::date
  end;
$$;

revoke all on function public.onboarding_parse_partial_date(text) from public, anon, authenticated;

create table if not exists public.profile_match_recompute_queue (
  profile_version_id uuid primary key references public.profile_versions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'passport_confirmed' check (reason in ('passport_confirmed', 'passport_material_change')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  available_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profile_match_recompute_pending_idx
  on public.profile_match_recompute_queue (status, available_at, created_at)
  where status in ('pending', 'failed');

alter table public.profile_match_recompute_queue enable row level security;
revoke all on public.profile_match_recompute_queue from anon, authenticated;
grant select, update, delete on public.profile_match_recompute_queue to service_role;

alter table public.product_analytics_events
  drop constraint if exists product_analytics_events_event_type_check;
alter table public.product_analytics_events
  add constraint product_analytics_events_event_type_check check (event_type in (
    'registration', 'onboarding_started', 'onboarding_stage_viewed',
    'onboarding_stage_completed', 'onboarding_stage_abandoned', 'onboarding_resumed',
    'onboarding_completed', 'optional_field_deferred', 'review_edit_requested',
    'first_useful_match', 'opportunity_saved', 'application_workspace_created',
    'application_submitted', 'outcome_recorded', 'alert_opened',
    'upgrade_completed', 'ai_exported', 'return_session'
  ));

drop trigger if exists phase3_updated_at on public.onboarding_progress;
create trigger phase3_updated_at
before update on public.onboarding_progress
for each row execute function public.phase3_set_updated_at();

create or replace function public.phase16_confirm_onboarding(
  candidate_snapshot jsonb,
  candidate_passport_readiness integer,
  candidate_trigger text default 'initial_review'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  owner_id uuid := auth.uid();
  fingerprint text;
  existing_version public.profile_versions%rowtype;
  new_version_id uuid;
  next_version integer;
  item jsonb;
  country_code text;
  destination_rank integer := 0;
  goal_rank integer := 0;
  open_to_other boolean := coalesce((candidate_snapshot->>'openToOtherDestinations')::boolean, false);
begin
  if owner_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if (
    select count(*)
    from (
      select distinct on (consent_type) consent_type, granted
      from public.user_consents
      where user_id = owner_id
        and consent_type in ('profile_matching', 'ai_processing', 'document_storage')
      order by consent_type, recorded_at desc
    ) latest_required_consent
    where granted
  ) <> 3 then
    raise exception 'CONSENT_REQUIRED';
  end if;
  if jsonb_typeof(candidate_snapshot) <> 'object' then raise exception 'INVALID_SNAPSHOT'; end if;
  if jsonb_typeof(candidate_snapshot->'selectedGoals') <> 'array'
    or jsonb_array_length(candidate_snapshot->'selectedGoals') = 0 then
    raise exception 'GOAL_REQUIRED';
  end if;
  if jsonb_typeof(candidate_snapshot->'destinations') <> 'array' then raise exception 'DESTINATIONS_INVALID'; end if;
  if jsonb_array_length(candidate_snapshot->'destinations') = 0 and not open_to_other then
    raise exception 'DESTINATION_REQUIRED';
  end if;
  if candidate_passport_readiness not between 0 and 100 then raise exception 'READINESS_INVALID'; end if;
  if candidate_trigger not in ('initial_review', 'manual_review') then raise exception 'TRIGGER_INVALID'; end if;

  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 1604));
  fingerprint := encode(digest(candidate_snapshot::text, 'sha256'), 'hex');

  select * into existing_version
  from public.profile_versions
  where user_id = owner_id
  order by version_number desc
  limit 1;

  if existing_version.id is not null and existing_version.snapshot_fingerprint = fingerprint then
    insert into public.onboarding_progress (
      user_id, selected_goal_types, current_section, draft, completion, passport_readiness,
      revision, flow_version, onboarding_started_at, completed_at
    ) values (
      owner_id,
      array(select jsonb_array_elements_text(candidate_snapshot->'selectedGoals')),
      'review', candidate_snapshot, 100, candidate_passport_readiness,
      existing_version.version_number, 'onboarding.optimized.v1', timezone('utc', now()), timezone('utc', now())
    ) on conflict (user_id) do update set
      selected_goal_types = excluded.selected_goal_types,
      current_section = excluded.current_section,
      draft = excluded.draft,
      completion = 100,
      passport_readiness = excluded.passport_readiness,
      revision = onboarding_progress.revision + 1,
      flow_version = excluded.flow_version,
      onboarding_started_at = coalesce(onboarding_progress.onboarding_started_at, excluded.onboarding_started_at),
      completed_at = coalesce(onboarding_progress.completed_at, excluded.completed_at);
    return jsonb_build_object('profile_version_id', existing_version.id, 'version_number', existing_version.version_number, 'reused', true);
  end if;

  update public.profiles set
    display_name = case when length(trim(coalesce(candidate_snapshot->>'preferredName', ''))) > 0 then candidate_snapshot->>'preferredName' else display_name end,
    citizenship_country = coalesce(candidate_snapshot->>'citizenshipCountry', ''),
    residence_country = coalesce(candidate_snapshot->>'residenceCountry', ''),
    current_region = coalesce(candidate_snapshot->>'currentRegion', ''),
    relocation_timeline = coalesce(candidate_snapshot->>'relocationTimeline', ''),
    passport_available = nullif(candidate_snapshot->>'passportAvailable', '')::boolean,
    passport_expiry = nullif(candidate_snapshot->>'passportExpiry', '')::date,
    willing_to_relocate = nullif(candidate_snapshot->>'willingToRelocate', '')::boolean
  where id = owner_id;

  delete from public.user_goals where user_id = owner_id;
  delete from public.education_records where user_id = owner_id;
  delete from public.employment_records where user_id = owner_id;
  delete from public.user_skills where user_id = owner_id;
  delete from public.certifications where user_id = owner_id;
  delete from public.trade_experience where user_id = owner_id;
  delete from public.language_profiles where user_id = owner_id;
  delete from public.country_preferences where user_id = owner_id;

  for item in select value from jsonb_array_elements(candidate_snapshot->'selectedGoals') loop
    goal_rank := goal_rank + 1;
    insert into public.user_goals(user_id, goal_type, priority)
    values (owner_id, item#>>'{}', goal_rank);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(candidate_snapshot->'education', '[]'::jsonb)) loop
    insert into public.education_records(
      user_id, institution, country, qualification_level, field_of_study, start_date, completion_date,
      graduation_status, grade_classification, gpa_value, gpa_scale, result_pending,
      expected_graduation_date, transcript_available, research_experience, publications, academic_awards
    ) values (
      owner_id, coalesce(item->>'institution',''), coalesce(item->>'country',''),
      coalesce(item->>'qualificationLevel',''), coalesce(item->>'fieldOfStudy',''),
      public.onboarding_parse_partial_date(item->>'startDate'),
      public.onboarding_parse_partial_date(item->>'completionDate'),
      coalesce(item->>'graduationStatus','completed'), coalesce(item->>'gradeClassification',''),
      nullif(item->>'gpaValue','')::numeric, nullif(item->>'gpaScale','')::numeric,
      coalesce((item->>'resultPending')::boolean, false),
      public.onboarding_parse_partial_date(item->>'expectedGraduationDate'),
      nullif(item->>'transcriptAvailable','')::boolean, coalesce(item->>'researchExperience',''),
      coalesce(item->>'publications',''), coalesce(item->>'academicAwards','')
    );
  end loop;

  for item in select value from jsonb_array_elements(coalesce(candidate_snapshot->'employment', '[]'::jsonb)) loop
    insert into public.employment_records(
      user_id, employer, job_title, country, employment_type, start_date, end_date, currently_employed,
      responsibilities, achievements, industry, occupation_category, management_experience,
      remote_international_experience
    ) values (
      owner_id, coalesce(item->>'employer',''), coalesce(item->>'jobTitle',''), coalesce(item->>'country',''),
      coalesce(item->>'employmentType',''),
      public.onboarding_parse_partial_date(item->>'startDate'),
      public.onboarding_parse_partial_date(item->>'endDate'),
      coalesce((item->>'currentlyEmployed')::boolean, false), coalesce(item->>'responsibilities',''),
      coalesce(item->>'achievements',''), coalesce(item->>'industry',''), coalesce(item->>'occupationCategory',''),
      nullif(item->>'managementExperience','')::boolean, nullif(item->>'remoteInternationalExperience','')::boolean
    );
  end loop;

  for item in select value from jsonb_array_elements(coalesce(candidate_snapshot->'skills', '[]'::jsonb)) loop
    insert into public.user_skills(user_id, skill_name, normalized_name, category, proficiency, years_experience, evidence)
    values (
      owner_id, item->>'skillName', lower(regexp_replace(trim(item->>'skillName'), '\s+', ' ', 'g')),
      coalesce(item->>'category','other'), coalesce(item->>'proficiency','developing'),
      nullif(item->>'yearsExperience','')::numeric, coalesce(item->>'evidence','')
    );
  end loop;

  for item in select value from jsonb_array_elements(coalesce(candidate_snapshot->'certifications', '[]'::jsonb)) loop
    insert into public.certifications(
      user_id, name, issuer, jurisdiction, issue_date, expiry_date, no_expiry, credential_status,
      credential_url, occupation_or_skill
    ) values (
      owner_id, coalesce(item->>'name',''), coalesce(item->>'issuer',''), coalesce(item->>'jurisdiction',''),
      public.onboarding_parse_partial_date(item->>'issueDate'),
      public.onboarding_parse_partial_date(item->>'expiryDate'),
      coalesce((item->>'noExpiry')::boolean, false), coalesce(item->>'credentialStatus','unverified'),
      coalesce(item->>'credentialUrl',''), coalesce(item->>'occupationOrSkill','')
    );
  end loop;

  for item in select value from jsonb_array_elements(coalesce(candidate_snapshot->'trade', '[]'::jsonb)) loop
    insert into public.trade_experience(
      user_id, trade_or_occupation, apprenticeship_status, practical_years, experience_documentation,
      employer_or_self_employed, trade_certification, licensing_status, portfolio_available,
      tools_equipment, driving_licence_classes, willing_to_complete_licensing, preferred_destination
    ) values (
      owner_id, coalesce(item->>'tradeOrOccupation',''), coalesce(item->>'apprenticeshipStatus','not_applicable'),
      nullif(item->>'practicalYears','')::numeric, coalesce(item->>'experienceDocumentation','informal'),
      coalesce(item->>'employerOrSelfEmployed',''), coalesce(item->>'tradeCertification',''),
      coalesce(item->>'licensingStatus','not_checked'), nullif(item->>'portfolioAvailable','')::boolean,
      coalesce(item->>'toolsEquipment',''), coalesce(item->>'drivingLicenceClasses',''),
      nullif(item->>'willingToCompleteLicensing','')::boolean, coalesce(item->>'preferredDestination','')
    );
  end loop;

  for item in select value from jsonb_array_elements(coalesce(candidate_snapshot->'languages', '[]'::jsonb)) loop
    insert into public.language_profiles(
      user_id, language, proficiency, test_name, test_status, overall_score, component_scores,
      test_date, expiry_date, target_score, planned_test_date
    ) values (
      owner_id, coalesce(item->>'language',''), coalesce(item->>'proficiency','self_assessed'),
      coalesce(item->>'testName',''), coalesce(item->>'testStatus','not_taken'),
      nullif(item->>'overallScore','')::numeric, coalesce(item->'componentScores','{}'::jsonb),
      public.onboarding_parse_partial_date(item->>'testDate'),
      public.onboarding_parse_partial_date(item->>'expiryDate'),
      nullif(item->>'targetScore','')::numeric,
      public.onboarding_parse_partial_date(item->>'plannedTestDate')
    );
  end loop;

  for country_code in select value from jsonb_array_elements_text(candidate_snapshot->'destinations') loop
    destination_rank := destination_rank + 1;
    insert into public.country_preferences(
      user_id, country_code, rank, excluded, open_to_other, opportunity_types, start_timeframe,
      funding_requirement, salary_expectation, willing_to_learn_language, work_mode
    ) values (
      owner_id, country_code, destination_rank, false, open_to_other,
      array(select jsonb_array_elements_text(coalesce(candidate_snapshot->'opportunityTypes','[]'::jsonb))),
      coalesce(candidate_snapshot->>'startTimeframe',''), coalesce(candidate_snapshot->>'fundingRequirement',''),
      coalesce(candidate_snapshot->>'salaryExpectation',''), nullif(candidate_snapshot->>'willingToLearnLanguage','')::boolean,
      coalesce(candidate_snapshot->>'workMode','')
    );
  end loop;
  if destination_rank = 0 and open_to_other then
    insert into public.country_preferences(user_id, country_code, rank, open_to_other)
    values (owner_id, 'ANY', 1, true);
  end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.profile_versions where user_id = owner_id;
  insert into public.profile_versions(
    user_id, version_number, schema_version, trigger, snapshot, snapshot_fingerprint
  ) values (
    owner_id, next_version, 'onboarding.optimized.v1', candidate_trigger, candidate_snapshot, fingerprint
  ) returning id into new_version_id;

  insert into public.profile_match_recompute_queue(profile_version_id, user_id, reason)
  values (new_version_id, owner_id, case when next_version = 1 then 'passport_confirmed' else 'passport_material_change' end)
  on conflict (profile_version_id) do nothing;

  insert into public.onboarding_progress(
    user_id, selected_goal_types, current_section, draft, completion, passport_readiness,
    revision, flow_version, onboarding_started_at, completed_at
  ) values (
    owner_id, array(select jsonb_array_elements_text(candidate_snapshot->'selectedGoals')),
    'review', candidate_snapshot, 100, candidate_passport_readiness, next_version,
    'onboarding.optimized.v1', timezone('utc', now()), timezone('utc', now())
  ) on conflict (user_id) do update set
    selected_goal_types = excluded.selected_goal_types,
    current_section = excluded.current_section,
    draft = excluded.draft,
    completion = 100,
    passport_readiness = excluded.passport_readiness,
    revision = onboarding_progress.revision + 1,
    flow_version = excluded.flow_version,
    onboarding_started_at = coalesce(onboarding_progress.onboarding_started_at, excluded.onboarding_started_at),
    completed_at = excluded.completed_at;

  return jsonb_build_object('profile_version_id', new_version_id, 'version_number', next_version, 'reused', false);
end;
$$;

revoke all on function public.phase16_confirm_onboarding(jsonb, integer, text) from public, anon;
grant execute on function public.phase16_confirm_onboarding(jsonb, integer, text) to authenticated;

comment on function public.phase16_confirm_onboarding(jsonb, integer, text) is
  'Atomically confirms an owner Passport, reuses an equivalent immutable snapshot, and idempotently queues rematching.';
comment on function public.onboarding_parse_partial_date(text) is
  'Server-only normalization for the existing year, year-month, and full-date Passport input contract.';
comment on column public.onboarding_progress.completion is
  'Four-stage activation completion. This is separate from long-term Passport readiness.';
comment on column public.onboarding_progress.passport_readiness is
  'Long-term Passport completeness for enrichment and preparation; it is not an eligibility score.';
