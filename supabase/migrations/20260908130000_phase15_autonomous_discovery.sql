-- WAYFOUND Phase 15: zero-cost autonomous opportunity discovery.
-- Search data and worker controls are service-only. Search snippets remain internal leads and
-- can never satisfy the Phase 4 publication-evidence gate.

alter table public.source_registry
  add column if not exists monitoring_method text,
  add column if not exists last_etag text,
  add column if not exists last_modified_header text,
  add column if not exists last_content_hash text,
  add column if not exists crawl_delay_ms integer not null default 1000,
  add column if not exists circuit_open_until timestamptz,
  add column if not exists last_monitor_attempt_at timestamptz;

alter table public.source_registry
  add constraint phase15_source_monitoring_method check (
    monitoring_method is null or monitoring_method in ('api','rss','atom','sitemap','structured_listing','json_ld','static_html','adapter')
  ),
  add constraint phase15_source_crawl_delay check (crawl_delay_ms between 0 and 86400000),
  add constraint phase15_source_etag_size check (last_etag is null or char_length(last_etag) <= 256),
  add constraint phase15_source_modified_size check (last_modified_header is null or char_length(last_modified_header) <= 256),
  add constraint phase15_source_hash check (last_content_hash is null or last_content_hash ~ '^[a-f0-9]{64}$');

create table public.opportunity_query_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  origin_country_code char(2) not null references public.countries(iso_alpha2) on delete restrict,
  destination_country_code char(2) not null references public.countries(iso_alpha2) on delete restrict,
  opportunity_type_code text not null references public.opportunity_types(code) on delete restrict,
  budget_group text not null,
  query_pattern text not null,
  priority_weight smallint not null default 50,
  active boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint phase15_query_template_key check (template_key ~ '^[a-z0-9._-]{3,120}$'),
  constraint phase15_query_budget_group check (budget_group in ('scholarship_fellowship','professional_graduate','skilled_trade','research_internship','underserved','reserve')),
  constraint phase15_query_pattern check (char_length(query_pattern) between 10 and 500),
  constraint phase15_query_priority check (priority_weight between 1 and 100)
);

create table public.opportunity_generated_queries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.opportunity_query_templates(id) on delete restrict,
  provider text not null default 'brave',
  query_text text not null,
  query_fingerprint text not null,
  scheduled_for date not null,
  status text not null default 'queued',
  attempt_count smallint not null default 0,
  result_count smallint not null default 0,
  useful_result_count smallint not null default 0,
  duplicate_result_count smallint not null default 0,
  rejected_result_count smallint not null default 0,
  lease_owner uuid,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz not null default timezone('utc', now()),
  safe_error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint phase15_generated_provider check (provider = 'brave'),
  constraint phase15_generated_query check (char_length(query_text) between 10 and 500),
  constraint phase15_generated_fingerprint check (query_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint phase15_generated_status check (status in ('queued','running','succeeded','zero_results','retry','failed','dead_letter','cancelled')),
  constraint phase15_generated_attempts check (attempt_count between 0 and 6),
  constraint phase15_generated_counts check (result_count between 0 and 20 and useful_result_count >= 0 and duplicate_result_count >= 0 and rejected_result_count >= 0),
  constraint phase15_generated_lease check ((lease_owner is null and lease_expires_at is null) or (lease_owner is not null and lease_expires_at is not null)),
  constraint phase15_generated_error check (safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{2,80}$'),
  unique (query_fingerprint, scheduled_for)
);

create table public.opportunity_search_runs (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.opportunity_generated_queries(id) on delete restrict,
  provider text not null,
  requested_result_count smallint not null,
  returned_result_count smallint not null default 0,
  provider_request_id text,
  state text not null default 'running',
  safe_error_code text,
  quota_day date not null,
  quota_month date not null,
  estimated_cost_microusd integer not null default 5000,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  constraint phase15_search_provider check (provider = 'brave'),
  constraint phase15_search_request_count check (requested_result_count between 1 and 20 and returned_result_count between 0 and 20),
  constraint phase15_search_request_id check (provider_request_id is null or char_length(provider_request_id) <= 160),
  constraint phase15_search_state check (state in ('running','succeeded','zero_results','rate_limited','quota_exhausted','failed')),
  constraint phase15_search_error check (safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{2,80}$'),
  constraint phase15_search_cost check (estimated_cost_microusd between 0 and 10000),
  constraint phase15_search_finished check ((state = 'running' and finished_at is null) or (state <> 'running' and finished_at is not null))
);

create table public.opportunity_discovery_leads (
  id uuid primary key default gen_random_uuid(),
  search_run_id uuid references public.opportunity_search_runs(id) on delete restrict,
  query_id uuid references public.opportunity_generated_queries(id) on delete restrict,
  provider text not null,
  result_url text not null,
  canonical_url text not null,
  result_domain text not null,
  result_title text not null,
  bounded_snippet text not null default '',
  result_position smallint not null,
  content_language text,
  provider_result_id text,
  processing_status text not null default 'new',
  retry_count smallint not null default 0,
  next_retry_at timestamptz,
  lease_owner uuid,
  lease_expires_at timestamptz,
  safe_rejection_reason text,
  idempotency_fingerprint text not null unique,
  first_discovered_at timestamptz not null default timezone('utc', now()),
  last_discovered_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint phase15_lead_provider check (provider in ('brave','direct_source')),
  constraint phase15_lead_urls check (char_length(result_url) between 8 and 2048 and char_length(canonical_url) between 8 and 2048),
  constraint phase15_lead_domain check (result_domain ~ '^[a-z0-9.-]{1,253}$'),
  constraint phase15_lead_title check (char_length(result_title) between 1 and 500),
  constraint phase15_lead_snippet check (char_length(bounded_snippet) <= 1000),
  constraint phase15_lead_position check (result_position between 1 and 100),
  constraint phase15_lead_language check (content_language is null or content_language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  constraint phase15_lead_provider_id check (provider_result_id is null or char_length(provider_result_id) <= 240),
  constraint phase15_lead_status check (processing_status in ('new','resolving','unresolved','source_verified','retrieving','extracting','validated','duplicate','published','rejected','retry','dead_letter')),
  constraint phase15_lead_retry check (retry_count between 0 and 6),
  constraint phase15_lead_lease check ((lease_owner is null and lease_expires_at is null) or (lease_owner is not null and lease_expires_at is not null)),
  constraint phase15_lead_rejection check (safe_rejection_reason is null or char_length(safe_rejection_reason) <= 500),
  constraint phase15_lead_fingerprint check (idempotency_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint phase15_lead_search_origin check ((provider = 'brave' and search_run_id is not null and query_id is not null) or provider = 'direct_source')
);

create table public.opportunity_domain_discovery_status (
  domain text primary key,
  verification_status text not null default 'unverified',
  source_id uuid references public.source_registry(id) on delete set null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  lead_count integer not null default 1,
  useful_count integer not null default 0,
  rejection_count integer not null default 0,
  safe_decision_basis text not null default 'new_domain',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint phase15_domain_name check (domain ~ '^[a-z0-9.-]{1,253}$'),
  constraint phase15_domain_status check (verification_status in ('unverified','pending','verified_official','verified_authoritative','approved_secondary','blocked')),
  constraint phase15_domain_counts check (lead_count > 0 and useful_count >= 0 and rejection_count >= 0),
  constraint phase15_domain_basis check (char_length(safe_decision_basis) between 2 and 240),
  constraint phase15_domain_verified_source check (verification_status not in ('verified_official','verified_authoritative','approved_secondary') or source_id is not null)
);

create table public.opportunity_source_resolution_attempts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.opportunity_discovery_leads(id) on delete cascade,
  candidate_url text not null,
  resolved_url text,
  resolved_source_id uuid references public.source_registry(id) on delete set null,
  source_strength text not null,
  status text not null,
  redirect_count smallint not null default 0,
  safe_reason text,
  attempted_at timestamptz not null default timezone('utc', now()),
  constraint phase15_resolution_urls check (char_length(candidate_url) between 8 and 2048 and (resolved_url is null or char_length(resolved_url) between 8 and 2048)),
  constraint phase15_resolution_strength check (source_strength in ('official_opportunity','official_organization','official_authority','authoritative_registry','approved_secondary','unverified_lead')),
  constraint phase15_resolution_status check (status in ('resolved','unresolved','blocked','retry')),
  constraint phase15_resolution_redirects check (redirect_count between 0 and 5),
  constraint phase15_resolution_reason check (safe_reason is null or char_length(safe_reason) <= 500)
);

create table public.opportunity_retrieval_attempts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.opportunity_discovery_leads(id) on delete cascade,
  source_id uuid references public.source_registry(id) on delete set null,
  retrieval_method text not null,
  request_url text not null,
  final_url text,
  status text not null,
  status_code smallint,
  content_type text,
  content_hash text,
  etag text,
  last_modified text,
  byte_length integer,
  safe_error_code text,
  retrieved_at timestamptz not null default timezone('utc', now()),
  constraint phase15_retrieval_method check (retrieval_method in ('api','rss','atom','sitemap','json_ld','static_html','adapter','ai')),
  constraint phase15_retrieval_urls check (char_length(request_url) between 8 and 2048 and (final_url is null or char_length(final_url) between 8 and 2048)),
  constraint phase15_retrieval_status check (status in ('succeeded','not_modified','blocked','timeout','rate_limited','unsupported','failed')),
  constraint phase15_retrieval_http check (status_code is null or status_code between 100 and 599),
  constraint phase15_retrieval_content_type check (content_type is null or char_length(content_type) <= 160),
  constraint phase15_retrieval_hash check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  constraint phase15_retrieval_headers check ((etag is null or char_length(etag) <= 256) and (last_modified is null or char_length(last_modified) <= 256)),
  constraint phase15_retrieval_size check (byte_length is null or byte_length between 0 and 5242880),
  constraint phase15_retrieval_error check (safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{2,80}$')
);

create table public.opportunity_extraction_attempts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.opportunity_discovery_leads(id) on delete cascade,
  retrieval_attempt_id uuid references public.opportunity_retrieval_attempts(id) on delete set null,
  extraction_method text not null,
  schema_version text not null,
  model_identifier text,
  prompt_version text,
  status text not null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  explicit_fact_count smallint not null default 0,
  unknown_fact_count smallint not null default 0,
  evidence_fragment_count smallint not null default 0,
  safe_error_code text,
  extracted_at timestamptz not null default timezone('utc', now()),
  constraint phase15_extraction_method check (extraction_method in ('source_adapter','structured_api','feed','json_ld','generic_html','bounded_ai')),
  constraint phase15_extraction_schema check (schema_version ~ '^[a-z0-9._-]{3,80}$'),
  constraint phase15_extraction_model check (model_identifier is null or char_length(model_identifier) <= 120),
  constraint phase15_extraction_prompt check (prompt_version is null or char_length(prompt_version) <= 80),
  constraint phase15_extraction_status check (status in ('accepted','incomplete','malformed','conflicting','rejected')),
  constraint phase15_extraction_counts check (explicit_fact_count >= 0 and unknown_fact_count >= 0 and evidence_fragment_count between 0 and 24),
  constraint phase15_extraction_error check (safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{2,80}$')
);

create table public.opportunity_deduplication_decisions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.opportunity_discovery_leads(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  decision text not null,
  match_basis text not null,
  decision_fingerprint text not null unique,
  safe_reason text not null,
  decided_at timestamptz not null default timezone('utc', now()),
  constraint phase15_dedupe_decision check (decision in ('new','exact_duplicate','probable_duplicate','distinct','annual_cycle','conflicting')),
  constraint phase15_dedupe_basis check (match_basis in ('canonical_url','resolved_url','external_source_id','content_hash','canonical_duplicate_key','normalized_facts','annual_cycle')),
  constraint phase15_dedupe_fingerprint check (decision_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint phase15_dedupe_reason check (char_length(safe_reason) between 2 and 500)
);

create table public.opportunity_recheck_schedules (
  opportunity_id uuid primary key references public.opportunities(id) on delete cascade,
  source_id uuid not null references public.source_registry(id) on delete restrict,
  cadence_hours integer not null,
  next_check_at timestamptz not null,
  state text not null default 'scheduled',
  consecutive_failure_count smallint not null default 0,
  lease_owner uuid,
  lease_expires_at timestamptz,
  last_checked_at timestamptz,
  last_outcome text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint phase15_recheck_cadence check (cadence_hours between 1 and 8760),
  constraint phase15_recheck_state check (state in ('scheduled','running','retry','complete','dead_letter','cancelled')),
  constraint phase15_recheck_failures check (consecutive_failure_count between 0 and 6),
  constraint phase15_recheck_lease check ((lease_owner is null and lease_expires_at is null) or (lease_owner is not null and lease_expires_at is not null)),
  constraint phase15_recheck_outcome check (last_outcome is null or last_outcome in ('unchanged','material_change','expired','withdrawn','inaccessible','superseded','failed'))
);

create table public.opportunity_provider_usage_windows (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  window_kind text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  hard_limit integer not null,
  request_count integer not null default 0,
  estimated_cost_microusd bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint phase15_usage_provider check (provider = 'brave'),
  constraint phase15_usage_kind check (window_kind in ('utc_day','calendar_month')),
  constraint phase15_usage_window check (window_end > window_start),
  constraint phase15_usage_limit check ((window_kind = 'utc_day' and hard_limit between 1 and 25) or (window_kind = 'calendar_month' and hard_limit between 1 and 750)),
  constraint phase15_usage_count check (request_count between 0 and hard_limit),
  constraint phase15_usage_cost check (estimated_cost_microusd >= 0),
  unique (provider, window_kind, window_start)
);

create table public.opportunity_discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  idempotency_key text not null unique,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  priority smallint not null default 50,
  attempt_count smallint not null default 0,
  maximum_attempts smallint not null default 3,
  available_at timestamptz not null default timezone('utc', now()),
  lease_owner uuid,
  lease_expires_at timestamptz,
  safe_error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint phase15_job_stage check (stage in ('query_generation','web_discovery','known_source_monitoring','lead_resolution','retrieval','extraction','validation','deduplication','confidence','publication','matching','notification','recheck','retry','cleanup')),
  constraint phase15_job_key check (idempotency_key ~ '^[A-Za-z0-9._:-]{8,180}$'),
  constraint phase15_job_status check (status in ('queued','running','succeeded','retry','failed','dead_letter','cancelled')),
  constraint phase15_job_payload check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 4096),
  constraint phase15_job_priority check (priority between 1 and 100),
  constraint phase15_job_attempts check (attempt_count between 0 and 6 and maximum_attempts between 1 and 6),
  constraint phase15_job_lease check ((lease_owner is null and lease_expires_at is null) or (lease_owner is not null and lease_expires_at is not null)),
  constraint phase15_job_error check (safe_error_code is null or safe_error_code ~ '^[a-z0-9_]{2,80}$')
);

create index phase15_generated_queries_queue_idx on public.opportunity_generated_queries(status, next_attempt_at, scheduled_for);
create index phase15_search_runs_started_idx on public.opportunity_search_runs(started_at desc);
create index phase15_leads_status_retry_idx on public.opportunity_discovery_leads(processing_status, next_retry_at, first_discovered_at);
create index phase15_leads_domain_idx on public.opportunity_discovery_leads(result_domain, last_discovered_at desc);
create index phase15_resolution_lead_idx on public.opportunity_source_resolution_attempts(lead_id, attempted_at desc);
create index phase15_retrieval_lead_idx on public.opportunity_retrieval_attempts(lead_id, retrieved_at desc);
create index phase15_extraction_lead_idx on public.opportunity_extraction_attempts(lead_id, extracted_at desc);
create index phase15_dedupe_opportunity_idx on public.opportunity_deduplication_decisions(opportunity_id, decided_at desc);
create index phase15_rechecks_due_idx on public.opportunity_recheck_schedules(state, next_check_at);
create index phase15_jobs_due_idx on public.opportunity_discovery_jobs(stage, status, available_at, priority desc);

create or replace function public.phase15_consume_search_quota(
  candidate_provider text,
  candidate_daily_limit integer,
  candidate_monthly_limit integer,
  requested_calls integer default 1
)
returns table(allowed boolean, daily_used integer, monthly_used integer, daily_remaining integer, monthly_remaining integer)
language plpgsql security definer set search_path = public as $$
declare
  now_utc timestamptz := timezone('utc', now());
  day_start timestamptz := date_trunc('day', now_utc);
  month_start timestamptz := date_trunc('month', now_utc);
  current_daily integer;
  current_monthly integer;
begin
  if candidate_provider <> 'brave' then raise exception 'Unsupported search provider'; end if;
  if candidate_daily_limit not between 1 and 25 or candidate_monthly_limit not between 1 and 750 then
    raise exception 'Search quota exceeds the zero-cost safety ceiling';
  end if;
  if requested_calls not between 1 and 10 then raise exception 'Invalid quota request'; end if;

  perform pg_advisory_xact_lock(hashtext('phase15:' || candidate_provider));

  insert into public.opportunity_provider_usage_windows(provider, window_kind, window_start, window_end, hard_limit)
  values
    (candidate_provider, 'utc_day', day_start, day_start + interval '1 day', candidate_daily_limit),
    (candidate_provider, 'calendar_month', month_start, month_start + interval '1 month', candidate_monthly_limit)
  on conflict (provider, window_kind, window_start) do update
    set hard_limit = least(public.opportunity_provider_usage_windows.hard_limit, excluded.hard_limit),
        updated_at = now_utc;

  select request_count into current_daily from public.opportunity_provider_usage_windows
    where provider = candidate_provider and window_kind = 'utc_day' and window_start = day_start for update;
  select request_count into current_monthly from public.opportunity_provider_usage_windows
    where provider = candidate_provider and window_kind = 'calendar_month' and window_start = month_start for update;

  if current_daily + requested_calls > candidate_daily_limit or current_monthly + requested_calls > candidate_monthly_limit then
    return query select false, current_daily, current_monthly,
      greatest(candidate_daily_limit - current_daily, 0), greatest(candidate_monthly_limit - current_monthly, 0);
    return;
  end if;

  update public.opportunity_provider_usage_windows
    set request_count = request_count + requested_calls,
        estimated_cost_microusd = estimated_cost_microusd + (requested_calls * 5000),
        updated_at = now_utc
    where provider = candidate_provider and window_start in (day_start, month_start);

  return query select true, current_daily + requested_calls, current_monthly + requested_calls,
    candidate_daily_limit - current_daily - requested_calls,
    candidate_monthly_limit - current_monthly - requested_calls;
end;
$$;

create or replace function public.phase15_record_discovery_lead(
  candidate_search_run uuid,
  candidate_query uuid,
  candidate_result_url text,
  candidate_canonical_url text,
  candidate_domain text,
  candidate_title text,
  candidate_snippet text,
  candidate_position integer,
  candidate_language text,
  candidate_provider_result_id text,
  candidate_fingerprint text
)
returns table(lead_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare saved_id uuid;
declare inserted boolean;
begin
  if candidate_result_url !~ '^https://' or candidate_canonical_url !~ '^https://' then raise exception 'Unsafe lead URL'; end if;
  if candidate_domain !~ '^[a-z0-9.-]{1,253}$' or candidate_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid lead identity'; end if;
  if char_length(candidate_title) not between 1 and 500 or char_length(candidate_snippet) > 1000 or candidate_position not between 1 and 20 then
    raise exception 'Invalid lead bounds';
  end if;
  insert into public.opportunity_discovery_leads(
    search_run_id, query_id, provider, result_url, canonical_url, result_domain,
    result_title, bounded_snippet, result_position, content_language,
    provider_result_id, idempotency_fingerprint
  ) values (
    candidate_search_run, candidate_query, 'brave', candidate_result_url,
    candidate_canonical_url, candidate_domain, candidate_title, candidate_snippet,
    candidate_position, candidate_language, candidate_provider_result_id, candidate_fingerprint
  )
  on conflict (idempotency_fingerprint) do update set
    last_discovered_at = timezone('utc', now()), updated_at = timezone('utc', now())
  returning id, (xmax = 0) into saved_id, inserted;

  insert into public.opportunity_domain_discovery_status(domain, lead_count)
  values (candidate_domain, case when inserted then 1 else 0 end)
  on conflict (domain) do update set
    last_seen_at = timezone('utc', now()),
    lead_count = public.opportunity_domain_discovery_status.lead_count + case when inserted then 1 else 0 end,
    updated_at = timezone('utc', now());

  return query select saved_id, inserted;
end;
$$;

create or replace function public.phase15_url_host(candidate_url text)
returns text language sql immutable strict set search_path = public as $$
  select lower(split_part(split_part(candidate_url, '://', 2), '/', 1));
$$;

create or replace function public.phase15_record_direct_source_lead(
  candidate_source uuid,
  candidate_url text,
  candidate_title text,
  candidate_fingerprint text
)
returns table(lead_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare source_row public.source_registry%rowtype;
declare candidate_domain text;
declare saved_id uuid;
declare inserted boolean;
begin
  select * into source_row from public.source_registry where id = candidate_source;
  if not found or not source_row.active or not source_row.is_allowed or source_row.is_fixture or source_row.robots_policy_status <> 'allowed' or source_row.terms_review_status <> 'approved' then
    raise exception 'Source is not eligible for direct monitoring';
  end if;
  candidate_domain := public.phase15_url_host(candidate_url);
  if candidate_url !~ '^https://' or candidate_fingerprint !~ '^[a-f0-9]{64}$' or char_length(candidate_title) not between 1 and 500 then
    raise exception 'Invalid direct-source lead';
  end if;
  if not (candidate_domain = source_row.canonical_domain or candidate_domain = any(source_row.allowed_domains)) then
    raise exception 'Direct-source URL is outside the registered domains';
  end if;
  insert into public.opportunity_discovery_leads(
    provider, result_url, canonical_url, result_domain, result_title,
    bounded_snippet, result_position, processing_status, idempotency_fingerprint
  ) values (
    'direct_source', candidate_url, candidate_url, candidate_domain, candidate_title,
    '', 1, 'source_verified', candidate_fingerprint
  )
  on conflict (idempotency_fingerprint) do update set
    last_discovered_at = timezone('utc', now()), updated_at = timezone('utc', now())
  returning id, (xmax = 0) into saved_id, inserted;
  return query select saved_id, inserted;
end;
$$;

create or replace function public.phase15_publish_candidate(
  candidate_lead uuid,
  candidate_source uuid,
  candidate_type_code text,
  candidate_title text,
  candidate_normalized_title text,
  candidate_organization text,
  candidate_destination_code text,
  candidate_is_global boolean,
  candidate_summary text,
  candidate_canonical_url text,
  candidate_application_url text,
  candidate_deadline date,
  candidate_rolling boolean,
  candidate_funding text,
  candidate_sponsorship text,
  candidate_content_hash text,
  candidate_duplicate_key text,
  candidate_evidence_excerpt text,
  candidate_decision_fingerprint text
)
returns table(opportunity_id uuid, opportunity_version_id uuid, confidence_assessment_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare source_row public.source_registry%rowtype;
declare type_id uuid;
declare country_id uuid;
declare saved_organization_id uuid;
declare saved_opportunity_id uuid;
declare saved_source_id uuid;
declare saved_evidence_id uuid;
declare saved_version_id uuid;
declare saved_confidence_id uuid;
declare was_created boolean := false;
declare canonical_host text;
declare application_host text;
begin
  if candidate_content_hash !~ '^[a-f0-9]{64}$' or candidate_decision_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid candidate fingerprint'; end if;
  if candidate_canonical_url !~ '^https://' or candidate_application_url !~ '^https://' then raise exception 'Unsafe candidate URL'; end if;
  if char_length(candidate_title) not between 1 and 500 or char_length(candidate_organization) not between 1 and 500 or char_length(candidate_evidence_excerpt) not between 1 and 4000 then raise exception 'Invalid candidate bounds'; end if;
  if candidate_deadline is null and not candidate_rolling then raise exception 'Deadline treatment is required'; end if;
  if candidate_deadline is not null and candidate_deadline < current_date then raise exception 'Expired candidate cannot be published'; end if;

  select * into source_row from public.source_registry where id = candidate_source for update;
  if not found or not source_row.active or not source_row.is_allowed or not source_row.is_official_source or source_row.is_fixture or source_row.trust_tier > 3 or source_row.robots_policy_status <> 'allowed' or source_row.terms_review_status <> 'approved' then
    raise exception 'Verified official source is required';
  end if;
  canonical_host := public.phase15_url_host(candidate_canonical_url);
  application_host := public.phase15_url_host(candidate_application_url);
  if not (canonical_host = source_row.canonical_domain or canonical_host = any(source_row.allowed_domains)) then raise exception 'Canonical URL is outside verified source domains'; end if;
  if not (application_host = source_row.canonical_domain or application_host = any(source_row.allowed_domains)) then raise exception 'Application URL is outside verified source domains'; end if;

  select id into type_id from public.opportunity_types where code = candidate_type_code;
  if type_id is null then raise exception 'Unknown opportunity type'; end if;
  if candidate_destination_code is not null then
    select id into country_id from public.countries where iso_alpha2 = candidate_destination_code and supported_destination;
    if country_id is null then raise exception 'Unsupported destination'; end if;
  elsif not candidate_is_global then
    raise exception 'Destination or documented global scope is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('phase15:publish:' || candidate_duplicate_key));
  insert into public.organizations(official_name, normalized_name, organization_type, country_id, official_domain, official_website_url, verification_status)
  values (candidate_organization, lower(regexp_replace(candidate_organization, '[^a-zA-Z0-9]+', ' ', 'g')), 'other', country_id, canonical_host, 'https://' || canonical_host || '/', 'verified')
  on conflict (normalized_name) do update set official_name = excluded.official_name
  returning id into saved_organization_id;

  select o.id into saved_opportunity_id from public.opportunities o
  where o.canonical_duplicate_key = candidate_duplicate_key
     or o.canonical_url = candidate_canonical_url
     or o.application_url = candidate_application_url
  order by o.created_at limit 1 for update;

  if saved_opportunity_id is null then
    insert into public.opportunities(
      opportunity_type_id, organization_id, title, normalized_title, destination_country_id,
      is_global, summary, application_deadline, rolling_deadline, application_url,
      canonical_url, original_source_url, funding_coverage, sponsorship_status,
      lifecycle_status, publication_status, evidence_status, is_fixture, last_checked_at,
      extraction_schema_version, content_hash, canonical_duplicate_key
    ) values (
      type_id, saved_organization_id, candidate_title, candidate_normalized_title, country_id,
      candidate_is_global, candidate_summary, candidate_deadline, candidate_rolling,
      candidate_application_url, candidate_canonical_url, candidate_canonical_url,
      candidate_funding, candidate_sponsorship, 'active', 'draft', 'unverified', false,
      timezone('utc', now()), 'phase15.v1', candidate_content_hash, candidate_duplicate_key
    ) returning id into saved_opportunity_id;
    was_created := true;
  else
    update public.opportunities set
      title = candidate_title, normalized_title = candidate_normalized_title,
      organization_id = saved_organization_id, destination_country_id = country_id,
      is_global = candidate_is_global, summary = candidate_summary,
      application_deadline = candidate_deadline, rolling_deadline = candidate_rolling,
      application_url = candidate_application_url, canonical_url = candidate_canonical_url,
      funding_coverage = candidate_funding, sponsorship_status = candidate_sponsorship,
      lifecycle_status = 'active', last_checked_at = timezone('utc', now()),
      extraction_schema_version = 'phase15.v1', content_hash = candidate_content_hash,
      canonical_duplicate_key = candidate_duplicate_key, updated_at = timezone('utc', now())
    where id = saved_opportunity_id;
  end if;

  insert into public.opportunity_sources(opportunity_id, source_id, source_url, canonical_url, relationship_type, source_priority, is_primary)
  values (saved_opportunity_id, candidate_source, candidate_canonical_url, candidate_canonical_url, 'primary_listing', 1, true)
  on conflict (opportunity_id, source_id, source_url) do update set active = true, last_seen_at = timezone('utc', now()), is_primary = true
  returning id into saved_source_id;

  select id into saved_evidence_id from public.opportunity_evidence
  where opportunity_id = saved_opportunity_id and source_id = candidate_source
    and content_hash = candidate_content_hash and fact_path = 'opportunity.listing' and active
  order by created_at desc limit 1;
  if saved_evidence_id is null then
    update public.opportunity_evidence set active = false
      where opportunity_id = saved_opportunity_id and source_id = candidate_source and fact_path = 'opportunity.listing' and active;
    insert into public.opportunity_evidence(
      opportunity_id, opportunity_source_id, source_id, source_url, canonical_url,
      evidence_type, fact_path, captured_excerpt, content_hash, http_metadata, language_code
    ) values (
      saved_opportunity_id, saved_source_id, candidate_source, candidate_canonical_url,
      candidate_canonical_url, 'listing', 'opportunity.listing', candidate_evidence_excerpt,
      candidate_content_hash, '{}'::jsonb, 'en'
    ) returning id into saved_evidence_id;
  end if;

  select id into saved_version_id from public.opportunity_versions
    where opportunity_id = saved_opportunity_id order by version_number desc limit 1;
  if saved_version_id is null then
    insert into public.opportunity_versions(opportunity_id, version_number, reason, schema_version, content_hash, snapshot)
    select id, 1, 'initial_ingestion', extraction_schema_version, content_hash, to_jsonb(o)
      from public.opportunities o where id = saved_opportunity_id
    returning id into saved_version_id;
  end if;

  insert into public.confidence_assessments(
    opportunity_id, opportunity_version_id, assessment_type, algorithm_version, input_fingerprint,
    source_confidence, sponsorship_confidence, sponsorship_outcome, decision, staleness_state, recheck_required
  ) values (
    saved_opportunity_id, saved_version_id, 'publication', 'phase15.v1', candidate_content_hash,
    greatest(70, 100 - ((source_row.trust_tier - 1) * 12)),
    case when candidate_sponsorship in ('vacancy_evidence','visa_support') then 90 when candidate_sponsorship = 'excluded' then 100 else 40 end,
    case when candidate_sponsorship = 'vacancy_evidence' then 'explicitly_confirmed'
         when candidate_sponsorship = 'visa_support' then 'strong_vacancy_indication'
         when candidate_sponsorship = 'excluded' then 'explicitly_unavailable'
         else 'not_stated' end,
    case when candidate_sponsorship in ('vacancy_evidence','visa_support','excluded') then 'allow' else 'limited' end,
    'fresh', false
  ) on conflict (opportunity_id, assessment_type, algorithm_version, input_fingerprint) do nothing
  returning id into saved_confidence_id;
  if saved_confidence_id is null then
    select id into saved_confidence_id from public.confidence_assessments
      where opportunity_id = saved_opportunity_id and assessment_type = 'publication'
        and algorithm_version = 'phase15.v1' and input_fingerprint = candidate_content_hash;
  end if;

  update public.opportunities set publication_status = 'published', evidence_status = 'sourced',
    lifecycle_status = case when candidate_deadline is not null and candidate_deadline <= current_date + 14 then 'closing_soon' else 'active' end,
    last_checked_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = saved_opportunity_id;

  insert into public.opportunity_deduplication_decisions(lead_id, opportunity_id, decision, match_basis, decision_fingerprint, safe_reason)
  values (candidate_lead, saved_opportunity_id, case when was_created then 'new' else 'exact_duplicate' end,
    case when was_created then 'normalized_facts' else 'canonical_duplicate_key' end,
    candidate_decision_fingerprint, case when was_created then 'validated_new_opportunity' else 'existing_opportunity_refreshed' end)
  on conflict (decision_fingerprint) do nothing;

  insert into public.opportunity_recheck_schedules(opportunity_id, source_id, cadence_hours, next_check_at)
  values (saved_opportunity_id, candidate_source, case when candidate_type_code in ('professional_job','graduate_programme','skilled_trade_work') then 6 else 24 end,
    timezone('utc', now()) + case when candidate_type_code in ('professional_job','graduate_programme','skilled_trade_work') then interval '6 hours' else interval '24 hours' end)
  on conflict (opportunity_id) do update set source_id = excluded.source_id, cadence_hours = excluded.cadence_hours,
    next_check_at = excluded.next_check_at, state = 'scheduled', updated_at = timezone('utc', now());

  update public.opportunity_discovery_leads set processing_status = 'published', updated_at = timezone('utc', now()) where id = candidate_lead;
  return query select saved_opportunity_id, saved_version_id, saved_confidence_id, was_created;
end;
$$;

create or replace function public.phase15_claim_discovery_jobs(
  candidate_stage text,
  candidate_worker uuid,
  candidate_batch_size integer default 5,
  lease_seconds integer default 120
)
returns setof public.opportunity_discovery_jobs
language plpgsql security definer set search_path = public as $$
begin
  if candidate_stage not in ('query_generation','web_discovery','known_source_monitoring','lead_resolution','retrieval','extraction','validation','deduplication','confidence','publication','matching','notification','recheck','retry','cleanup') then
    raise exception 'Invalid discovery stage';
  end if;
  if candidate_batch_size not between 1 and 20 or lease_seconds not between 30 and 300 then
    raise exception 'Invalid discovery job bounds';
  end if;
  return query
  with candidates as (
    select id from public.opportunity_discovery_jobs
    where stage = candidate_stage
      and status in ('queued','retry')
      and available_at <= timezone('utc', now())
      and (lease_expires_at is null or lease_expires_at <= timezone('utc', now()))
    order by priority desc, available_at, id
    for update skip locked
    limit candidate_batch_size
  )
  update public.opportunity_discovery_jobs j
    set status = 'running', lease_owner = candidate_worker,
        lease_expires_at = timezone('utc', now()) + make_interval(secs => lease_seconds),
        attempt_count = attempt_count + 1, started_at = coalesce(started_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
  from candidates c where j.id = c.id
  returning j.*;
end;
$$;

create or replace function public.phase15_claim_generated_query(
  candidate_worker uuid,
  lease_seconds integer default 120
)
returns setof public.opportunity_generated_queries
language plpgsql security definer set search_path = public as $$
begin
  if lease_seconds not between 30 and 300 then raise exception 'Invalid query lease bounds'; end if;
  return query
  with candidate as (
    select id from public.opportunity_generated_queries
    where status in ('queued','retry')
      and next_attempt_at <= timezone('utc', now())
      and (lease_expires_at is null or lease_expires_at <= timezone('utc', now()))
    order by scheduled_for, next_attempt_at, id
    for update skip locked
    limit 1
  )
  update public.opportunity_generated_queries q
    set status = 'running', lease_owner = candidate_worker,
        lease_expires_at = timezone('utc', now()) + make_interval(secs => lease_seconds),
        attempt_count = attempt_count + 1, started_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
  from candidate c where q.id = c.id
  returning q.*;
end;
$$;

create or replace function public.phase15_claim_discovery_lead(
  candidate_worker uuid,
  candidate_batch_size integer default 4,
  lease_seconds integer default 120
)
returns setof public.opportunity_discovery_leads
language plpgsql security definer set search_path = public as $$
begin
  if candidate_batch_size not between 1 and 10 or lease_seconds not between 30 and 300 then raise exception 'Invalid lead lease bounds'; end if;
  return query
  with candidates as (
    select id from public.opportunity_discovery_leads
    where processing_status in ('new','retry','source_verified')
      and (next_retry_at is null or next_retry_at <= timezone('utc', now()))
      and (lease_expires_at is null or lease_expires_at <= timezone('utc', now()))
    order by first_discovered_at, id
    for update skip locked
    limit candidate_batch_size
  )
  update public.opportunity_discovery_leads l
    set processing_status = 'resolving', lease_owner = candidate_worker,
        lease_expires_at = timezone('utc', now()) + make_interval(secs => lease_seconds),
        updated_at = timezone('utc', now())
  from candidates c where l.id = c.id
  returning l.*;
end;
$$;

create or replace function public.phase15_finish_discovery_job(
  candidate_job uuid,
  candidate_worker uuid,
  candidate_status text,
  candidate_error_code text default null,
  retry_after_seconds integer default null
)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if candidate_status not in ('succeeded','retry','failed','dead_letter','cancelled') then
    raise exception 'Invalid terminal discovery status';
  end if;
  if candidate_error_code is not null and candidate_error_code !~ '^[a-z0-9_]{2,80}$' then
    raise exception 'Invalid discovery error code';
  end if;
  update public.opportunity_discovery_jobs
    set status = candidate_status,
        safe_error_code = candidate_error_code,
        available_at = case when candidate_status = 'retry' then timezone('utc', now()) + make_interval(secs => greatest(coalesce(retry_after_seconds, 300), 60)) else available_at end,
        lease_owner = null, lease_expires_at = null,
        completed_at = case when candidate_status in ('succeeded','failed','dead_letter','cancelled') then timezone('utc', now()) else null end,
        updated_at = timezone('utc', now())
    where id = candidate_job and lease_owner = candidate_worker and status = 'running';
  return found;
end;
$$;

create or replace function public.phase15_cleanup_terminal_jobs(retention_days integer default 90)
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  if retention_days not between 30 and 365 then raise exception 'Invalid retention period'; end if;
  delete from public.opportunity_discovery_jobs
    where status in ('succeeded','failed','dead_letter','cancelled')
      and completed_at < timezone('utc', now()) - make_interval(days => retention_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create view public.phase15_discovery_operations_summary as
select
  coalesce((select sum(request_count) from public.opportunity_provider_usage_windows where provider = 'brave' and window_kind = 'utc_day' and window_start = date_trunc('day', timezone('utc', now()))), 0)::integer as searches_today,
  coalesce((select max(hard_limit) from public.opportunity_provider_usage_windows where provider = 'brave' and window_kind = 'utc_day' and window_start = date_trunc('day', timezone('utc', now()))), 25)::integer as daily_limit,
  coalesce((select sum(request_count) from public.opportunity_provider_usage_windows where provider = 'brave' and window_kind = 'calendar_month' and window_start = date_trunc('month', timezone('utc', now()))), 0)::integer as searches_this_month,
  coalesce((select max(hard_limit) from public.opportunity_provider_usage_windows where provider = 'brave' and window_kind = 'calendar_month' and window_start = date_trunc('month', timezone('utc', now()))), 750)::integer as monthly_limit,
  (select count(*)::integer from public.opportunity_discovery_leads where first_discovered_at >= timezone('utc', now()) - interval '24 hours') as leads_last_24_hours,
  (select count(*)::integer from public.opportunity_discovery_leads where processing_status = 'duplicate' and updated_at >= timezone('utc', now()) - interval '24 hours') as duplicates_last_24_hours,
  (select count(*)::integer from public.opportunity_discovery_leads where processing_status in ('rejected','dead_letter') and updated_at >= timezone('utc', now()) - interval '24 hours') as rejected_last_24_hours,
  (select count(*)::integer from public.opportunity_discovery_leads where processing_status = 'published' and updated_at >= timezone('utc', now()) - interval '24 hours') as published_last_24_hours,
  (select count(*)::integer from public.opportunity_discovery_leads where processing_status in ('new','resolving','unresolved','source_verified','retrieving','extracting','validated','retry')) as lead_backlog,
  (select count(*)::integer from public.opportunity_domain_discovery_status where verification_status = 'unverified') as unverified_domains,
  (select count(*)::integer from public.opportunity_retrieval_attempts where status in ('blocked','timeout','rate_limited','unsupported','failed') and retrieved_at >= timezone('utc', now()) - interval '24 hours') as retrieval_failures_last_24_hours,
  (select count(*)::integer from public.opportunity_extraction_attempts where status in ('incomplete','malformed','conflicting','rejected') and extracted_at >= timezone('utc', now()) - interval '24 hours') as extraction_failures_last_24_hours,
  (select max(updated_at) from public.opportunity_discovery_leads where processing_status = 'published') as last_successful_end_to_end_at;

insert into public.source_registry (
  source_name, source_type, base_url, canonical_domain, trust_tier, is_official_source,
  is_allowed, discovery_method, robots_policy_status, terms_review_status, active,
  parser_adapter_identifier, adapter_identifier, adapter_version, allowed_domains,
  request_timeout_ms, response_size_limit_bytes, redirect_limit, concurrency_limit,
  retry_limit, refresh_frequency_hours, crawl_policy_notes, internal_notes, is_fixture
)
values (
  'Brave Search discovery provider', 'search_provider', 'https://api.search.brave.com/',
  'api.search.brave.com', 5, false, true, 'search_provider', 'allowed', 'approved', true,
  'search.brave', 'search.brave', 'phase15.v1', array['api.search.brave.com'],
  10000, 1048576, 0, 1, 1, 24,
  'Search results are internal discovery hints only and can never be publication evidence.',
  'Provider credentials are environment-only and are never stored in this registry.', false
)
on conflict (base_url) do update set
  source_name = excluded.source_name,
  source_type = excluded.source_type,
  trust_tier = excluded.trust_tier,
  is_official_source = excluded.is_official_source,
  is_allowed = excluded.is_allowed,
  active = excluded.active,
  adapter_identifier = excluded.adapter_identifier,
  adapter_version = excluded.adapter_version,
  allowed_domains = excluded.allowed_domains,
  internal_notes = excluded.internal_notes;

insert into public.opportunity_query_templates (
  template_key, origin_country_code, destination_country_code, opportunity_type_code,
  budget_group, query_pattern, priority_weight
)
select
  'ng.' || lower(c.iso_alpha2) || '.' || ot.code,
  'NG', c.iso_alpha2, ot.code,
  case
    when ot.code in ('scholarship','fellowship') then 'scholarship_fellowship'
    when ot.code in ('graduate_programme','professional_job') then 'professional_graduate'
    when ot.code = 'skilled_trade_work' then 'skilled_trade'
    else 'research_internship'
  end,
  '{current_year} ' || c.name || ' ' || replace(ot.display_name, ' job', '') ||
    ' international applicants Nigeria official application deadline',
  case when c.iso_alpha2 in ('IE','NL','NZ') then 65 else 50 end
from public.countries c
cross join public.opportunity_types ot
where c.iso_alpha2 in ('CN','GB','CA','AU','DE','IE','NL','US','NZ')
on conflict (template_key) do nothing;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'opportunity_query_templates','opportunity_generated_queries','opportunity_search_runs',
    'opportunity_discovery_leads','opportunity_domain_discovery_status',
    'opportunity_source_resolution_attempts','opportunity_retrieval_attempts',
    'opportunity_extraction_attempts','opportunity_deduplication_decisions',
    'opportunity_recheck_schedules','opportunity_provider_usage_windows','opportunity_discovery_jobs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end $$;

revoke all on public.phase15_discovery_operations_summary from anon, authenticated;
revoke execute on function public.phase15_consume_search_quota(text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.phase15_record_discovery_lead(uuid, uuid, text, text, text, text, text, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.phase15_record_direct_source_lead(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.phase15_publish_candidate(uuid, uuid, text, text, text, text, text, boolean, text, text, text, date, boolean, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.phase15_claim_discovery_jobs(text, uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.phase15_claim_generated_query(uuid, integer) from public, anon, authenticated;
revoke execute on function public.phase15_claim_discovery_lead(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.phase15_finish_discovery_job(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.phase15_cleanup_terminal_jobs(integer) from public, anon, authenticated;

comment on table public.opportunity_discovery_leads is 'Internal search and direct-source leads. Snippets are hints only and never publication evidence.';
comment on table public.opportunity_provider_usage_windows is 'Atomic zero-cost provider usage windows. No credential or request header is stored.';
comment on view public.phase15_discovery_operations_summary is 'Privacy-safe service-only autonomous-discovery metrics.';
