-- WAYFOUND Phase 2: identity, consent and account-lifecycle foundations.
-- User-owned records are protected by RLS. No client role is granted access to
-- the audit log, and no destructive account operation is performed here.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  first_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_display_name_length check (char_length(display_name) <= 160),
  constraint profiles_first_name_length check (char_length(first_name) <= 80)
);

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  policy_version text not null,
  consent_type text not null,
  granted boolean not null,
  required boolean not null default false,
  source text not null default 'web',
  recorded_at timestamptz not null default timezone('utc', now()),
  constraint user_consents_type check (
    consent_type in ('profile_matching', 'ai_processing', 'document_storage', 'notifications')
  ),
  constraint user_consents_source check (source in ('web', 'magic_link', 'oauth', 'system'))
);

create index if not exists user_consents_user_version_idx
  on public.user_consents (user_id, policy_version, consent_type, recorded_at desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_enabled boolean not null default false,
  telegram_enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint audit_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint audit_events_type check (
    event_type in (
      'account_registered', 'account_login', 'account_logout', 'account_logout_all',
      'email_verification_requested', 'password_recovery_requested', 'password_reset',
      'magic_link_requested', 'oauth_started', 'oauth_cancelled', 'consent_recorded',
      'data_export_requested', 'account_deletion_requested', 'account_deletion_cancelled'
    )
  )
);

create index if not exists audit_events_user_created_idx
  on public.audit_events (user_id, created_at desc);

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  failure_code text,
  constraint data_export_requests_status check (status in ('pending', 'processing', 'completed', 'failed'))
);

create unique index if not exists one_active_export_request_per_user
  on public.data_export_requests (user_id)
  where status in ('pending', 'processing');

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default timezone('utc', now()),
  grace_period_ends_at timestamptz not null,
  cancelled_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint account_deletion_requests_status check (
    status in ('pending', 'cancelled', 'processing', 'completed')
  )
);

create unique index if not exists one_active_deletion_request_per_user
  on public.account_deletion_requests (user_id)
  where status in ('pending', 'processing');

create or replace function public.phase2_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_phase2_updated_at on public.profiles;
create trigger profiles_phase2_updated_at
before update on public.profiles
for each row execute function public.phase2_set_updated_at();

drop trigger if exists preferences_phase2_updated_at on public.notification_preferences;
create trigger preferences_phase2_updated_at
before update on public.notification_preferences
for each row execute function public.phase2_set_updated_at();

drop trigger if exists export_requests_phase2_updated_at on public.data_export_requests;
create trigger export_requests_phase2_updated_at
before update on public.data_export_requests
for each row execute function public.phase2_set_updated_at();

drop trigger if exists deletion_requests_phase2_updated_at on public.account_deletion_requests;
create trigger deletion_requests_phase2_updated_at
before update on public.account_deletion_requests
for each row execute function public.phase2_set_updated_at();

create or replace function public.phase2_bootstrap_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.notification_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.phase2_bootstrap_auth_user() from public;

drop trigger if exists wayfound_phase2_bootstrap_auth_user on auth.users;
create trigger wayfound_phase2_bootstrap_auth_user
after insert on auth.users
for each row execute function public.phase2_bootstrap_auth_user();

create or replace function public.cancel_account_deletion_request(request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed boolean;
begin
  update public.account_deletion_requests
  set status = 'cancelled', cancelled_at = timezone('utc', now())
  where id = request_id
    and user_id = auth.uid()
    and status = 'pending'
    and grace_period_ends_at > timezone('utc', now());
  changed := found;
  return changed;
end;
$$;

revoke all on function public.cancel_account_deletion_request(uuid) from public;
grant execute on function public.cancel_account_deletion_request(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_consents enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_events enable row level security;
alter table public.data_export_requests enable row level security;
alter table public.account_deletion_requests enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists consents_select_own on public.user_consents;
create policy consents_select_own on public.user_consents for select to authenticated using (user_id = auth.uid());
drop policy if exists consents_insert_own on public.user_consents;
create policy consents_insert_own on public.user_consents for insert to authenticated with check (user_id = auth.uid());

drop policy if exists preferences_select_own on public.notification_preferences;
create policy preferences_select_own on public.notification_preferences for select to authenticated using (user_id = auth.uid());
drop policy if exists preferences_insert_own on public.notification_preferences;
create policy preferences_insert_own on public.notification_preferences for insert to authenticated with check (user_id = auth.uid());
drop policy if exists preferences_update_own on public.notification_preferences;
create policy preferences_update_own on public.notification_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists audit_insert_own on public.audit_events;
create policy audit_insert_own on public.audit_events for insert to authenticated with check (user_id = auth.uid());

drop policy if exists export_select_own on public.data_export_requests;
create policy export_select_own on public.data_export_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists export_insert_own on public.data_export_requests;
create policy export_insert_own on public.data_export_requests for insert to authenticated with check (user_id = auth.uid());

drop policy if exists deletion_select_own on public.account_deletion_requests;
create policy deletion_select_own on public.account_deletion_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists deletion_insert_own on public.account_deletion_requests;
create policy deletion_insert_own on public.account_deletion_requests for insert to authenticated with check (user_id = auth.uid());

revoke all on public.profiles from anon;
revoke all on public.user_consents from anon;
revoke all on public.notification_preferences from anon;
revoke all on public.audit_events from anon;
revoke all on public.data_export_requests from anon;
revoke all on public.account_deletion_requests from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.user_consents to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant insert on public.audit_events to authenticated;
grant select, insert on public.data_export_requests to authenticated;
grant select, insert on public.account_deletion_requests to authenticated;

comment on table public.profiles is 'WAYFOUND Phase 2 user profile bootstrap; identity-owned fields only.';
comment on table public.user_consents is 'Append-only, versioned consent history. Never overwrite prior decisions.';
comment on table public.audit_events is 'Redacted security-sensitive audit events; client roles cannot read this table.';
comment on table public.data_export_requests is 'Retryable export queue foundation; delivery worker is intentionally separate.';
comment on table public.account_deletion_requests is 'Grace-period deletion queue foundation; retention policy remains configurable before production.';
