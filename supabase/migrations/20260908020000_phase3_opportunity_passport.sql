-- WAYFOUND Phase 3: dynamic Opportunity Passport and private document metadata.
-- Working drafts are user-owned JSON snapshots for safe resume; confirmed profile
-- records remain normalized relational data and profile_versions is append-only.

alter table public.user_consents drop constraint if exists user_consents_type;
alter table public.user_consents add constraint user_consents_type check (
  consent_type in (
    'profile_matching', 'ai_processing', 'document_storage', 'notifications',
    'email_notifications', 'telegram_notifications'
  )
);

comment on column public.user_consents.consent_type is
  'Versioned purpose consent. Legacy notifications rows are preserved; new channel choices are independent.';

alter table public.profiles
  add column if not exists citizenship_country text not null default '',
  add column if not exists residence_country text not null default '',
  add column if not exists current_region text not null default '',
  add column if not exists relocation_timeline text not null default '',
  add column if not exists passport_available boolean,
  add column if not exists passport_expiry date,
  add column if not exists willing_to_relocate boolean;

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_type text not null,
  priority smallint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_goals_type check (goal_type in (
    'study_funding', 'fellowship_graduate', 'research', 'internship',
    'professional_sponsorship', 'skilled_trade'
  )),
  constraint user_goals_priority check (priority between 1 and 20),
  unique (user_id, goal_type)
);

create table if not exists public.education_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution text not null default '',
  country text not null default '',
  qualification_level text not null default '',
  field_of_study text not null default '',
  start_date date,
  completion_date date,
  graduation_status text not null default 'completed',
  grade_classification text not null default '',
  gpa_value numeric(6,3),
  gpa_scale numeric(6,3),
  result_pending boolean not null default false,
  expected_graduation_date date,
  transcript_available boolean,
  research_experience text not null default '',
  publications text not null default '',
  academic_awards text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint education_status check (graduation_status in ('completed', 'awaiting_graduation', 'currently_studying', 'result_pending')),
  constraint education_gpa_value check (gpa_value is null or gpa_value >= 0),
  constraint education_gpa_scale check (gpa_scale is null or gpa_scale > 0)
);

create table if not exists public.employment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  employer text not null default '',
  job_title text not null default '',
  country text not null default '',
  employment_type text not null default '',
  start_date date,
  end_date date,
  currently_employed boolean not null default false,
  responsibilities text not null default '',
  achievements text not null default '',
  industry text not null default '',
  occupation_category text not null default '',
  management_experience boolean,
  remote_international_experience boolean,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employment_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  category text not null default 'other',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid references public.skills (id) on delete set null,
  skill_name text not null,
  normalized_name text not null,
  category text not null default 'other',
  proficiency text not null default 'developing',
  years_experience numeric(5,2),
  evidence text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_skills_proficiency check (proficiency in ('beginner', 'developing', 'proficient', 'advanced')),
  constraint user_skills_years check (years_experience is null or (years_experience >= 0 and years_experience <= 80)),
  unique (user_id, normalized_name)
);

create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  issuer text not null default '',
  jurisdiction text not null default '',
  issue_date date,
  expiry_date date,
  no_expiry boolean not null default false,
  credential_status text not null default 'unverified',
  credential_url text not null default '',
  occupation_or_skill text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint certification_status check (credential_status in ('unverified', 'active', 'expired', 'pending')),
  constraint certification_expiry check (no_expiry or expiry_date is not null)
);

create table if not exists public.trade_experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_or_occupation text not null default '',
  apprenticeship_status text not null default 'not_applicable',
  practical_years numeric(5,2),
  experience_documentation text not null default 'informal',
  employer_or_self_employed text not null default '',
  trade_certification text not null default '',
  licensing_status text not null default 'not_checked',
  portfolio_available boolean,
  tools_equipment text not null default '',
  driving_licence_classes text not null default '',
  willing_to_complete_licensing boolean,
  preferred_destination text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trade_years check (practical_years is null or (practical_years >= 0 and practical_years <= 80)),
  constraint trade_documentation check (experience_documentation in ('informal', 'formally_documented', 'both')),
  constraint trade_licensing check (licensing_status in ('licensed', 'in_progress', 'not_checked', 'not_applicable'))
);

create table if not exists public.language_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null default '',
  proficiency text not null default 'self_assessed',
  test_name text not null default '',
  test_status text not null default 'not_taken',
  overall_score numeric(5,2),
  component_scores jsonb not null default '{}'::jsonb,
  test_date date,
  expiry_date date,
  target_score numeric(5,2),
  planned_test_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint language_test_status check (test_status in ('not_taken', 'booked', 'taken', 'official', 'practice_estimate')),
  constraint language_overall_score check (overall_score is null or (overall_score >= 0 and overall_score <= 9)),
  constraint language_target_score check (target_score is null or (target_score >= 0 and target_score <= 9)),
  constraint language_components_object check (jsonb_typeof(component_scores) = 'object')
);

create table if not exists public.country_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  country_code text not null,
  rank smallint not null default 1,
  excluded boolean not null default false,
  open_to_other boolean not null default false,
  opportunity_types text[] not null default '{}',
  start_timeframe text not null default '',
  funding_requirement text not null default '',
  salary_expectation text not null default '',
  willing_to_learn_language boolean,
  work_mode text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, country_code, excluded)
);

create table if not exists public.document_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_type text not null,
  readiness_status text not null default 'not_applicable',
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint document_readiness check (readiness_status in ('available', 'unavailable', 'expired', 'pending', 'not_applicable')),
  constraint document_size check (size_bytes is null or (size_bytes > 0 and size_bytes <= 10485760)),
  unique (user_id, document_type)
);

create table if not exists public.onboarding_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  selected_goal_types text[] not null default '{}',
  current_section text not null default 'goals',
  draft jsonb not null default '{}'::jsonb,
  completion integer not null default 0,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint onboarding_completion check (completion between 0 and 100),
  constraint onboarding_draft_object check (jsonb_typeof(draft) = 'object')
);

create table if not exists public.profile_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version_number integer not null,
  schema_version text not null default 'phase3.v1',
  trigger text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint profile_versions_trigger check (trigger in ('initial_review', 'goals_changed', 'education_changed', 'employment_changed', 'language_changed', 'destinations_changed', 'certification_changed', 'manual_review')),
  constraint profile_versions_snapshot_object check (jsonb_typeof(snapshot) = 'object'),
  unique (user_id, version_number)
);

create table if not exists public.cv_parse_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid references public.document_metadata (id) on delete cascade,
  status text not null default 'queued',
  provider text not null default 'disabled',
  provider_schema_version text not null default 'phase3.cv.v1',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cv_job_status check (status in ('queued', 'processing', 'completed', 'failed', 'disabled'))
);

create table if not exists public.profile_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.cv_parse_jobs (id) on delete cascade,
  field_path text not null,
  proposed_value jsonb not null,
  evidence text not null default '',
  status text not null default 'pending',
  provider_schema_version text not null default 'phase3.cv.v1',
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint profile_suggestion_status check (status in ('pending', 'accepted', 'edited', 'rejected')),
  constraint profile_suggestion_value check (jsonb_typeof(proposed_value) in ('string', 'number', 'boolean', 'object', 'array'))
);

create index if not exists phase3_user_tables_user_idx on public.user_goals (user_id);
create index if not exists education_records_user_idx on public.education_records (user_id);
create index if not exists employment_records_user_idx on public.employment_records (user_id);
create index if not exists user_skills_user_idx on public.user_skills (user_id);
create index if not exists certifications_user_idx on public.certifications (user_id);
create index if not exists trade_experience_user_idx on public.trade_experience (user_id);
create index if not exists language_profiles_user_idx on public.language_profiles (user_id);
create index if not exists country_preferences_user_idx on public.country_preferences (user_id);
create index if not exists document_metadata_user_idx on public.document_metadata (user_id);
create index if not exists profile_versions_user_created_idx on public.profile_versions (user_id, created_at desc);
create index if not exists cv_parse_jobs_user_idx on public.cv_parse_jobs (user_id, created_at desc);
create index if not exists profile_suggestions_user_idx on public.profile_suggestions (user_id, created_at desc);

create or replace function public.phase3_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['user_goals','education_records','employment_records','user_skills','certifications','trade_experience','language_profiles','country_preferences','document_metadata','cv_parse_jobs'] loop
    execute format('drop trigger if exists phase3_updated_at on public.%I', table_name);
    execute format('create trigger phase3_updated_at before update on public.%I for each row execute function public.phase3_set_updated_at()', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['user_goals','education_records','employment_records','user_skills','certifications','trade_experience','language_profiles','country_preferences','document_metadata','onboarding_progress','profile_versions','cv_parse_jobs','profile_suggestions'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end $$;

create policy user_goals_own on public.user_goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy education_records_own on public.education_records for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy employment_records_own on public.employment_records for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_skills_own on public.user_skills for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy certifications_own on public.certifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy trade_experience_own on public.trade_experience for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy language_profiles_own on public.language_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy country_preferences_own on public.country_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy document_metadata_own on public.document_metadata for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy onboarding_progress_own on public.onboarding_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profile_versions_select_own on public.profile_versions for select to authenticated using (user_id = auth.uid());
create policy profile_versions_insert_own on public.profile_versions for insert to authenticated with check (user_id = auth.uid());
create policy cv_parse_jobs_own on public.cv_parse_jobs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profile_suggestions_own on public.profile_suggestions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy skills_read_authenticated on public.skills for select to authenticated using (is_active = true);
revoke insert, update, delete on public.skills from authenticated;

grant select, insert, update, delete on public.user_goals, public.education_records, public.employment_records, public.user_skills, public.certifications, public.trade_experience, public.language_profiles, public.country_preferences, public.document_metadata, public.onboarding_progress, public.cv_parse_jobs, public.profile_suggestions to authenticated;
grant select, insert on public.profile_versions to authenticated;
grant select on public.skills to authenticated;
grant update on public.profiles to authenticated;

insert into storage.buckets (id, name, public)
values ('user-documents', 'user-documents', false)
on conflict (id) do update set public = false;

drop policy if exists user_documents_select_own on storage.objects;
create policy user_documents_select_own on storage.objects for select to authenticated using (
  bucket_id = 'user-documents' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists user_documents_insert_own on storage.objects;
create policy user_documents_insert_own on storage.objects for insert to authenticated with check (
  bucket_id = 'user-documents' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists user_documents_update_own on storage.objects;
create policy user_documents_update_own on storage.objects for update to authenticated using (
  bucket_id = 'user-documents' and (storage.foldername(name))[1] = auth.uid()::text
) with check (bucket_id = 'user-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists user_documents_delete_own on storage.objects;
create policy user_documents_delete_own on storage.objects for delete to authenticated using (
  bucket_id = 'user-documents' and (storage.foldername(name))[1] = auth.uid()::text
);

comment on table public.onboarding_progress is 'Validated, user-owned working draft; normalized confirmed records are the matching source of truth.';
comment on table public.profile_versions is 'Append-only confirmed profile snapshots for future matching; clients cannot update or delete versions.';
comment on table public.document_metadata is 'Private document readiness and storage metadata; no public URLs are created.';
comment on table public.profile_suggestions is 'Untrusted, field-level CV proposals requiring explicit user confirmation.';
