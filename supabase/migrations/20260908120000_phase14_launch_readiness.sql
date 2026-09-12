-- WAYFOUND Phase 14: paid-beta launch readiness controls.
-- Operational security data is service-owned. Users receive no direct write path.

create table public.security_rate_limit_windows (
  scope text not null check (scope ~ '^[a-z0-9_.:-]{1,80}$'),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (scope, subject_hash, window_started_at),
  constraint security_rate_limit_expiry check (expires_at > window_started_at)
);

create index security_rate_limit_expiry_idx
  on public.security_rate_limit_windows (expires_at);

create table public.product_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'registration', 'onboarding_completed', 'first_useful_match', 'opportunity_saved',
    'application_workspace_created', 'application_submitted', 'outcome_recorded',
    'alert_opened', 'upgrade_completed', 'ai_exported', 'return_session'
  )),
  idempotency_key uuid not null unique,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  constraint product_analytics_properties_object check (jsonb_typeof(properties) = 'object'),
  constraint product_analytics_properties_size check (octet_length(properties::text) <= 2048)
);

create index product_analytics_event_time_idx
  on public.product_analytics_events (event_type, occurred_at desc);

create table public.document_scan_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  purpose text not null check (purpose in ('passport_document', 'application_document', 'ielts_recording')),
  quarantine_path text not null check (quarantine_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/'),
  final_path text,
  original_filename text not null check (length(original_filename) between 1 and 240),
  content_type text not null check (content_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 15728640),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  provider text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  status text not null default 'pending' check (status in ('pending', 'scanning', 'clean', 'infected', 'error')),
  failure_category text check (failure_category in ('provider_unavailable', 'timeout', 'invalid_response', 'malware_detected', 'promotion_failed')),
  created_at timestamptz not null default timezone('utc', now()),
  scanned_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, purpose, idempotency_key),
  constraint document_scan_terminal_state check (
    (status in ('pending', 'scanning') and scanned_at is null)
    or (status in ('clean', 'infected', 'error') and scanned_at is not null)
  ),
  constraint document_scan_final_path check (status <> 'clean' or final_path is not null)
);

create index document_scan_backlog_idx
  on public.document_scan_records (status, created_at)
  where status in ('pending', 'scanning', 'error');

create table public.document_scan_events (
  id bigint generated always as identity primary key,
  scan_id uuid not null references public.document_scan_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'scanning', 'clean', 'infected', 'error')),
  category text,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index document_scan_events_scan_idx
  on public.document_scan_events (scan_id, occurred_at);

create or replace function public.phase14_consume_rate_limit(
  candidate_scope text,
  candidate_subject_hash text,
  maximum_requests integer,
  window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  started_at timestamptz;
  new_count integer;
begin
  if candidate_scope !~ '^[a-z0-9_.:-]{1,80}$'
    or candidate_subject_hash !~ '^[0-9a-f]{64}$'
    or maximum_requests not between 1 and 10000
    or window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate-limit request';
  end if;

  started_at := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / window_seconds) * window_seconds
  );

  insert into public.security_rate_limit_windows (
    scope, subject_hash, window_started_at, request_count, expires_at
  ) values (
    candidate_scope, candidate_subject_hash, started_at, 1, started_at + make_interval(secs => window_seconds)
  )
  on conflict (scope, subject_hash, window_started_at)
  do update set request_count = public.security_rate_limit_windows.request_count + 1
  returning request_count into new_count;

  return query select
    new_count <= maximum_requests,
    greatest(0, maximum_requests - new_count),
    started_at + make_interval(secs => window_seconds);
end;
$$;

create or replace function public.phase14_reject_immutable_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Phase 14 event history is immutable';
end;
$$;

create trigger product_analytics_events_immutable
before update or delete on public.product_analytics_events
for each row execute function public.phase14_reject_immutable_change();

create trigger document_scan_events_immutable
before update or delete on public.document_scan_events
for each row execute function public.phase14_reject_immutable_change();

create or replace function public.phase14_purge_expired_operational_data(retention_days integer default 30)
returns table (rate_limits_deleted bigint, analytics_deleted bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rate_count bigint;
  analytics_count bigint;
begin
  if retention_days not between 7 and 365 then
    raise exception 'Invalid retention period';
  end if;
  delete from public.security_rate_limit_windows where expires_at < timezone('utc', now()) - interval '1 day';
  get diagnostics rate_count = row_count;
  delete from public.product_analytics_events where occurred_at < timezone('utc', now()) - make_interval(days => retention_days);
  get diagnostics analytics_count = row_count;
  return query select rate_count, analytics_count;
end;
$$;

alter table public.security_rate_limit_windows enable row level security;
alter table public.product_analytics_events enable row level security;
alter table public.document_scan_records enable row level security;
alter table public.document_scan_events enable row level security;

create policy document_scan_records_select_own on public.document_scan_records
for select to authenticated using (user_id = auth.uid());
create policy document_scan_events_select_own on public.document_scan_events
for select to authenticated using (user_id = auth.uid());

revoke all on public.security_rate_limit_windows, public.product_analytics_events,
  public.document_scan_records, public.document_scan_events from anon, authenticated;
grant select on public.document_scan_records, public.document_scan_events to authenticated;

revoke all on function public.phase14_consume_rate_limit(text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.phase14_purge_expired_operational_data(integer) from public, anon, authenticated;
revoke all on function public.phase14_reject_immutable_change() from public, anon, authenticated;
grant execute on function public.phase14_consume_rate_limit(text,text,integer,integer) to service_role;
grant execute on function public.phase14_purge_expired_operational_data(integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-document-quarantine',
  'user-document-quarantine',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Quarantine intentionally has no anon/authenticated storage.objects policies.
