-- WAYFOUND Phase 5: server-operated, policy-aware opportunity ingestion.
-- This migration stores operational metadata and bounded evidence only. It does not grant any
-- ingestion capability to browser roles and does not publish records outside Phase 4 safeguards.

alter table public.source_registry
  add column if not exists adapter_identifier text,
  add column if not exists adapter_version text,
  add column if not exists allowed_domains text[] not null default '{}',
  add column if not exists request_timeout_ms integer not null default 10000,
  add column if not exists response_size_limit_bytes integer not null default 1048576,
  add column if not exists redirect_limit smallint not null default 3,
  add column if not exists concurrency_limit smallint not null default 1,
  add column if not exists retry_limit smallint not null default 3,
  add column if not exists next_eligible_run_at timestamptz,
  add column if not exists consecutive_failure_count integer not null default 0;

create or replace function public.phase5_domains_valid(domains text[])
returns boolean language plpgsql immutable set search_path = public as $$
declare domain text;
begin
  if cardinality(domains) > 32 then return false; end if;
  foreach domain in array domains loop
    if domain !~ '^[a-z0-9.-]+$' then return false; end if;
  end loop;
  return true;
end;
$$;

alter table public.source_registry
  add constraint source_registry_ingestion_limits check (
    request_timeout_ms between 1000 and 30000
    and response_size_limit_bytes between 1024 and 5242880
    and redirect_limit between 0 and 5
    and concurrency_limit between 1 and 8
    and retry_limit between 0 and 5
    and consecutive_failure_count >= 0
  ),
  add constraint source_registry_allowed_domains check (public.phase5_domains_valid(allowed_domains));

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null,
  adapter_identifier text not null,
  adapter_version text not null,
  state text not null default 'running',
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  source_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  conflicted_count integer not null default 0,
  rejected_count integer not null default 0,
  retry_count integer not null default 0,
  safe_error_summary text,
  constraint ingestion_runs_state check (state in ('running','succeeded','partial','failed','cancelled')),
  constraint ingestion_runs_correlation check (correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$'),
  constraint ingestion_runs_counts check (source_count >= 0 and created_count >= 0 and updated_count >= 0 and unchanged_count >= 0 and conflicted_count >= 0 and rejected_count >= 0 and retry_count >= 0),
  constraint ingestion_runs_finished check ((state = 'running' and finished_at is null) or (state <> 'running' and finished_at is not null)),
  constraint ingestion_runs_safe_error check (safe_error_summary is null or char_length(safe_error_summary) <= 500)
);

create table public.ingestion_source_runs (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null references public.ingestion_runs(id) on delete cascade,
  source_id uuid not null references public.source_registry(id) on delete restrict,
  adapter_identifier text not null,
  adapter_version text not null,
  state text not null default 'queued',
  checkpoint_before jsonb not null default '{}'::jsonb,
  checkpoint_after jsonb not null default '{}'::jsonb,
  pages_seen integer not null default 0,
  records_seen integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_unchanged integer not null default 0,
  records_conflicted integer not null default 0,
  retry_count integer not null default 0,
  error_classification text,
  safe_error_summary text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ingestion_source_runs_state check (state in ('queued','running','succeeded','partial','failed','dead_letter','skipped')),
  constraint ingestion_source_runs_counts check (pages_seen >= 0 and records_seen >= 0 and records_created >= 0 and records_updated >= 0 and records_unchanged >= 0 and records_conflicted >= 0 and retry_count >= 0),
  constraint ingestion_source_runs_checkpoint check (jsonb_typeof(checkpoint_before) = 'object' and jsonb_typeof(checkpoint_after) = 'object'),
  constraint ingestion_source_runs_error check (error_classification is null or error_classification in ('timeout','rate_limited','temporary_http','permanent_http','invalid_content','policy_blocked','adapter_failure','validation_failure','unknown')),
  constraint ingestion_source_runs_safe_error check (safe_error_summary is null or char_length(safe_error_summary) <= 500),
  unique (ingestion_run_id, source_id)
);

create unique index ingestion_source_runs_active_source_idx on public.ingestion_source_runs(source_id)
  where state in ('queued','running');

create table public.ingestion_checkpoints (
  source_id uuid primary key references public.source_registry(id) on delete cascade,
  adapter_identifier text not null,
  adapter_version text not null,
  cursor jsonb not null default '{}'::jsonb,
  last_completed_at timestamptz,
  last_successful_run_id uuid references public.ingestion_runs(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ingestion_checkpoints_cursor check (jsonb_typeof(cursor) = 'object')
);

create table public.ingestion_leases (
  source_id uuid primary key references public.source_registry(id) on delete cascade,
  lease_owner uuid not null,
  correlation_id text not null,
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ingestion_leases_expiry check (lease_expires_at > created_at),
  constraint ingestion_leases_correlation check (correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$')
);

create table public.ingestion_failures (
  id uuid primary key default gen_random_uuid(),
  source_run_id uuid not null references public.ingestion_source_runs(id) on delete cascade,
  candidate_external_source_id text,
  failure_stage text not null,
  classification text not null,
  retryable boolean not null,
  attempt_number smallint not null,
  safe_error_summary text not null,
  next_retry_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ingestion_failures_stage check (failure_stage in ('discovery','fetch','extract','validate','normalize','persist','publish')),
  constraint ingestion_failures_classification check (classification in ('timeout','rate_limited','temporary_http','permanent_http','invalid_content','policy_blocked','adapter_failure','validation_failure','unknown')),
  constraint ingestion_failures_attempt check (attempt_number between 1 and 6),
  constraint ingestion_failures_summary check (char_length(safe_error_summary) between 1 and 500),
  constraint ingestion_failures_retry check ((retryable and next_retry_at is not null) or (not retryable and next_retry_at is null))
);

create table public.ingestion_responses (
  id uuid primary key default gen_random_uuid(),
  source_run_id uuid not null references public.ingestion_source_runs(id) on delete cascade,
  source_id uuid not null references public.source_registry(id) on delete restrict,
  request_url text not null,
  final_url text not null,
  status_code smallint not null,
  content_type text,
  content_hash text,
  etag text,
  last_modified text,
  retrieved_at timestamptz not null default timezone('utc', now()),
  byte_length integer not null,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb,
  constraint ingestion_responses_status check (status_code between 100 and 599),
  constraint ingestion_responses_size check (byte_length between 0 and 5242880),
  constraint ingestion_responses_excerpt check (excerpt is null or char_length(excerpt) <= 4000),
  constraint ingestion_responses_metadata check (jsonb_typeof(metadata) = 'object')
);

create table public.ingestion_candidates (
  id uuid primary key default gen_random_uuid(),
  source_run_id uuid not null references public.ingestion_source_runs(id) on delete cascade,
  source_id uuid not null references public.source_registry(id) on delete restrict,
  external_source_id text,
  canonical_url text not null,
  content_hash text not null,
  extraction_schema_version text not null,
  extraction_status text not null,
  normalized_payload jsonb not null,
  safe_rejection_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ingestion_candidates_status check (extraction_status in ('accepted','rejected','conflicting','quarantined')),
  constraint ingestion_candidates_payload check (jsonb_typeof(normalized_payload) = 'object'),
  constraint ingestion_candidates_rejection check ((extraction_status = 'accepted' and safe_rejection_reason is null) or (extraction_status <> 'accepted' and safe_rejection_reason is not null and char_length(safe_rejection_reason) <= 500)),
  unique (source_id, canonical_url, content_hash)
);

create table public.opportunity_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  ingestion_candidate_id uuid not null references public.ingestion_candidates(id) on delete cascade,
  existing_opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  match_basis text not null,
  state text not null default 'open',
  created_at timestamptz not null default timezone('utc', now()),
  constraint opportunity_duplicate_candidates_basis check (match_basis in ('source_external_id','canonical_url','canonical_duplicate_key','content_hash','normalized_facts')),
  constraint opportunity_duplicate_candidates_state check (state in ('open','resolved_same','resolved_distinct','conflicting')),
  unique (ingestion_candidate_id, existing_opportunity_id, match_basis)
);

create index ingestion_runs_state_started_idx on public.ingestion_runs(state, started_at desc);
create index ingestion_source_runs_source_state_idx on public.ingestion_source_runs(source_id, state, created_at desc);
create index ingestion_failures_retry_idx on public.ingestion_failures(next_retry_at) where retryable and resolved_at is null;
create index ingestion_responses_source_hash_idx on public.ingestion_responses(source_id, content_hash);
create index ingestion_candidates_source_external_idx on public.ingestion_candidates(source_id, external_source_id);
create index ingestion_candidates_canonical_url_idx on public.ingestion_candidates(canonical_url);
create index opportunity_duplicate_candidates_open_idx on public.opportunity_duplicate_candidates(existing_opportunity_id) where state = 'open';
create index source_registry_next_eligible_idx on public.source_registry(next_eligible_run_at) where active and is_allowed and not is_fixture;

create or replace function public.phase5_acquire_source_lease(source uuid, owner uuid, correlation text, duration_seconds integer default 300)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if duration_seconds not between 30 and 900 then raise exception 'Invalid lease duration'; end if;
  insert into public.ingestion_leases(source_id, lease_owner, correlation_id, lease_expires_at)
  values (source, owner, correlation, timezone('utc', now()) + make_interval(secs => duration_seconds))
  on conflict (source_id) do update set lease_owner = excluded.lease_owner, correlation_id = excluded.correlation_id, lease_expires_at = excluded.lease_expires_at, updated_at = timezone('utc', now())
  where public.ingestion_leases.lease_expires_at <= timezone('utc', now()) or public.ingestion_leases.lease_owner = excluded.lease_owner;
  return found;
end;
$$;

create or replace function public.phase5_release_source_lease(source uuid, owner uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from public.ingestion_leases where source_id = source and lease_owner = owner;
  return found;
end;
$$;

alter table public.ingestion_runs enable row level security;
alter table public.ingestion_source_runs enable row level security;
alter table public.ingestion_checkpoints enable row level security;
alter table public.ingestion_leases enable row level security;
alter table public.ingestion_failures enable row level security;
alter table public.ingestion_responses enable row level security;
alter table public.ingestion_candidates enable row level security;
alter table public.opportunity_duplicate_candidates enable row level security;

revoke all on public.ingestion_runs, public.ingestion_source_runs, public.ingestion_checkpoints, public.ingestion_leases, public.ingestion_failures, public.ingestion_responses, public.ingestion_candidates, public.opportunity_duplicate_candidates from anon, authenticated;
revoke execute on function public.phase5_acquire_source_lease(uuid, uuid, text, integer), public.phase5_release_source_lease(uuid, uuid) from public, anon, authenticated;
comment on table public.ingestion_responses is 'Bounded metadata and limited excerpts only; never full pages, credentials, or request headers.';
comment on table public.ingestion_candidates is 'Internal validated candidate/quarantine records. No browser role access.';
