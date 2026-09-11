-- WAYFOUND Phase 11: private email and Telegram notification delivery.
-- Provider credentials, one-time link tokens and message bodies remain server-only.

alter table public.notification_preferences
  add column if not exists email_frequency text not null default 'off',
  add column if not exists telegram_frequency text not null default 'off',
  add column if not exists timezone_name text not null default 'Africa/Lagos',
  add column if not exists quiet_hours_enabled boolean not null default false,
  add column if not exists quiet_hours_start time not null default '22:00',
  add column if not exists quiet_hours_end time not null default '07:00',
  add column if not exists event_types text[] not null default array[
    'new_match', 'strong_match', 'deadline', 'missing_document', 'interview',
    'opportunity_expired', 'opportunity_withdrawn'
  ]::text[];

alter table public.notification_preferences
  drop constraint if exists notification_preferences_email_frequency_check,
  add constraint notification_preferences_email_frequency_check
    check (email_frequency in ('off', 'instant', 'daily', 'weekly', 'deadline_only')),
  drop constraint if exists notification_preferences_telegram_frequency_check,
  add constraint notification_preferences_telegram_frequency_check
    check (telegram_frequency in ('off', 'instant', 'daily', 'weekly', 'deadline_only')),
  drop constraint if exists notification_preferences_timezone_check,
  add constraint notification_preferences_timezone_check
    check (char_length(timezone_name) between 1 and 80 and timezone_name ~ '^[A-Za-z_+.-]+(/[A-Za-z0-9_+.-]+)*$'),
  drop constraint if exists notification_preferences_event_types_check,
  add constraint notification_preferences_event_types_check
    check (event_types <@ array[
      'new_match', 'strong_match', 'deadline', 'missing_document', 'interview',
      'opportunity_expired', 'opportunity_withdrawn'
    ]::text[] and cardinality(event_types) between 0 and 7);

update public.notification_preferences
set email_frequency = case when email_enabled then 'instant' else 'off' end,
    telegram_frequency = case when telegram_enabled then 'instant' else 'off' end
where email_frequency = 'off' and telegram_frequency = 'off';

create table public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  chat_id text not null,
  display_label text,
  status text not null default 'active',
  linked_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint telegram_links_chat_id_length check (char_length(chat_id) between 1 and 80),
  constraint telegram_links_label_length check (display_label is null or char_length(display_label) <= 80),
  constraint telegram_links_status_check check (status in ('active', 'revoked')),
  constraint telegram_links_revocation_check check (
    (status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null)
  )
);

create unique index telegram_links_one_active_chat_idx on public.telegram_links (chat_id) where status = 'active';

create table public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  attempt_count smallint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint telegram_link_tokens_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint telegram_link_tokens_expiry_check check (expires_at > created_at and expires_at <= created_at + interval '30 minutes'),
  constraint telegram_link_tokens_attempt_check check (attempt_count between 0 and 5),
  constraint telegram_link_tokens_terminal_check check (consumed_at is null or revoked_at is null)
);

create index telegram_link_tokens_user_created_idx on public.telegram_link_tokens (user_id, created_at desc);
create index telegram_link_tokens_expiry_idx on public.telegram_link_tokens (expires_at) where consumed_at is null and revoked_at is null;

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  resource_kind text not null,
  resource_id uuid not null,
  deduplication_key text not null,
  deep_link text not null,
  safe_context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  status text not null default 'queued',
  created_at timestamptz not null default timezone('utc', now()),
  constraint notification_events_type_check check (event_type in (
    'new_match', 'strong_match', 'deadline', 'missing_document', 'interview',
    'opportunity_expired', 'opportunity_withdrawn'
  )),
  constraint notification_events_resource_check check (
    (event_type in ('new_match', 'strong_match', 'opportunity_expired', 'opportunity_withdrawn') and resource_kind = 'opportunity')
    or (event_type in ('deadline', 'missing_document', 'interview') and resource_kind = 'application')
  ),
  constraint notification_events_deduplication_check check (deduplication_key ~ '^[a-f0-9]{64}$'),
  constraint notification_events_deep_link_check check (
    (resource_kind = 'opportunity' and deep_link = '/opportunities/' || resource_id::text)
    or (resource_kind = 'application' and deep_link = '/applications/' || resource_id::text)
  ),
  constraint notification_events_context_check check (
    jsonb_typeof(safe_context) = 'object' and octet_length(safe_context::text) <= 2048
    and safe_context - array['days_remaining', 'urgency', 'status_label']::text[] = '{}'::jsonb
  ),
  constraint notification_events_status_check check (status in ('queued', 'cancelled')),
  unique (user_id, deduplication_key)
);

create index notification_events_user_created_idx on public.notification_events (user_id, created_at desc);
create index notification_events_resource_idx on public.notification_events (user_id, resource_kind, resource_id);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null,
  status text not null default 'queued',
  available_at timestamptz not null,
  attempt_count smallint not null default 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_message_id text,
  failure_code text,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notification_deliveries_channel_check check (channel in ('email', 'telegram')),
  constraint notification_deliveries_status_check check (
    status in ('queued', 'scheduled', 'sending', 'retry', 'sent', 'suppressed', 'permanent_failure')
  ),
  constraint notification_deliveries_attempt_check check (attempt_count between 0 and 5),
  constraint notification_deliveries_provider_id_check check (
    provider_message_id is null or char_length(provider_message_id) <= 180
  ),
  constraint notification_deliveries_failure_check check (failure_code is null or failure_code in (
    'provider_disabled', 'provider_timeout', 'provider_temporary', 'provider_permanent',
    'consent_missing', 'email_unverified', 'channel_disabled', 'telegram_unlinked',
    'unsubscribed', 'expired_event', 'invalid_destination'
  )),
  constraint notification_deliveries_lease_check check (
    (lease_token is null and lease_expires_at is null) or (lease_token is not null and lease_expires_at is not null)
  ),
  unique (event_id, channel)
);

create index notification_deliveries_due_idx
  on public.notification_deliveries (available_at, created_at)
  where status in ('queued', 'scheduled', 'retry', 'sending');
create index notification_deliveries_user_created_idx on public.notification_deliveries (user_id, created_at desc);

create table public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.notification_deliveries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_number smallint not null,
  outcome text not null,
  provider_request_id text,
  failure_code text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint notification_attempts_number_check check (attempt_number between 1 and 5),
  constraint notification_attempts_outcome_check check (outcome in ('sent', 'retry', 'suppressed', 'permanent_failure')),
  constraint notification_attempts_provider_id_check check (
    provider_request_id is null or char_length(provider_request_id) <= 180
  ),
  constraint notification_attempts_failure_check check (
    failure_code is null or char_length(failure_code) between 1 and 80
  ),
  unique (delivery_id, attempt_number)
);

create index notification_attempts_user_created_idx on public.notification_delivery_attempts (user_id, created_at desc);

create table public.notification_suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null,
  reason text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  released_at timestamptz,
  constraint notification_suppressions_channel_check check (channel in ('email', 'telegram')),
  constraint notification_suppressions_reason_check check (reason in (
    'user_unsubscribed', 'provider_bounce', 'provider_complaint', 'invalid_destination'
  )),
  constraint notification_suppressions_release_check check (
    (active and released_at is null) or (not active and released_at is not null)
  )
);

create unique index notification_suppressions_active_idx
  on public.notification_suppressions (user_id, channel) where active;

create or replace function public.phase11_validate_delivery_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.notification_events e
    where e.id = new.event_id and e.user_id = new.user_id
  ) then
    raise exception 'notification delivery owner mismatch';
  end if;
  return new;
end;
$$;

create or replace function public.phase11_validate_attempt_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.notification_deliveries d
    where d.id = new.delivery_id and d.user_id = new.user_id
  ) then
    raise exception 'notification attempt owner mismatch';
  end if;
  return new;
end;
$$;

create trigger notification_deliveries_owner_guard
before insert or update on public.notification_deliveries
for each row execute function public.phase11_validate_delivery_owner();

create trigger notification_attempts_owner_guard
before insert or update on public.notification_delivery_attempts
for each row execute function public.phase11_validate_attempt_owner();

create trigger telegram_links_updated_at
before update on public.telegram_links
for each row execute function public.phase2_set_updated_at();

create trigger notification_deliveries_updated_at
before update on public.notification_deliveries
for each row execute function public.phase2_set_updated_at();

create or replace function public.phase11_validate_telegram_preference()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email_enabled := new.email_frequency <> 'off';
  new.telegram_enabled := new.telegram_frequency <> 'off';
  if new.telegram_enabled and not exists (
    select 1 from public.telegram_links l where l.user_id = new.user_id and l.status = 'active'
  ) then
    raise exception 'an active Telegram link is required';
  end if;
  return new;
end;
$$;

create trigger notification_preferences_phase11_guard
before insert or update on public.notification_preferences
for each row execute function public.phase11_validate_telegram_preference();

create or replace function public.phase11_create_telegram_link_token(token_digest text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  token_id uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if token_digest !~ '^[a-f0-9]{64}$' then raise exception 'invalid token digest'; end if;

  update public.telegram_link_tokens
  set revoked_at = timezone('utc', now())
  where user_id = current_user_id and consumed_at is null and revoked_at is null;

  insert into public.telegram_link_tokens (user_id, token_hash, expires_at)
  values (current_user_id, token_digest, timezone('utc', now()) + interval '15 minutes')
  returning id into token_id;
  return token_id;
end;
$$;

create or replace function public.phase11_consume_telegram_link_token(
  token_digest text,
  candidate_chat_id text,
  candidate_display_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate public.telegram_link_tokens%rowtype;
  linked_id uuid;
begin
  if token_digest !~ '^[a-f0-9]{64}$' or char_length(candidate_chat_id) not between 1 and 80 then
    raise exception 'invalid Telegram link request';
  end if;

  select * into candidate from public.telegram_link_tokens
  where token_hash = token_digest
  for update;

  if candidate.id is null or candidate.consumed_at is not null or candidate.revoked_at is not null
     or candidate.expires_at <= timezone('utc', now()) then
    raise exception 'Telegram link token is invalid or expired';
  end if;

  update public.telegram_links
  set status = 'revoked', revoked_at = timezone('utc', now())
  where chat_id = candidate_chat_id and user_id <> candidate.user_id and status = 'active';

  insert into public.telegram_links (user_id, chat_id, display_label)
  values (candidate.user_id, candidate_chat_id, nullif(left(candidate_display_label, 80), ''))
  on conflict (user_id) do update
    set chat_id = excluded.chat_id, display_label = excluded.display_label,
        status = 'active', linked_at = timezone('utc', now()), revoked_at = null
  returning id into linked_id;

  update public.telegram_link_tokens set consumed_at = timezone('utc', now()) where id = candidate.id;
  return linked_id;
end;
$$;

create or replace function public.phase11_unlink_telegram()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.telegram_links
  set status = 'revoked', revoked_at = timezone('utc', now())
  where user_id = auth.uid() and status = 'active';
  changed := found;
  update public.notification_preferences
  set telegram_frequency = 'off', telegram_enabled = false
  where user_id = auth.uid();
  return changed;
end;
$$;

create or replace function public.phase11_save_notification_preferences(
  candidate_email_frequency text,
  candidate_telegram_frequency text,
  candidate_timezone_name text,
  candidate_quiet_hours_enabled boolean,
  candidate_quiet_hours_start time,
  candidate_quiet_hours_end time,
  candidate_event_types text[],
  email_consent boolean,
  telegram_consent boolean,
  candidate_policy_version text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  latest_email boolean;
  latest_telegram boolean;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if char_length(candidate_policy_version) not between 1 and 80 then raise exception 'invalid policy version'; end if;
  if candidate_email_frequency <> 'off' and not email_consent then raise exception 'email consent required'; end if;
  if candidate_email_frequency <> 'off' and not exists (
    select 1 from auth.users where id = current_user_id and email_confirmed_at is not null
  ) then raise exception 'verified email required'; end if;
  if candidate_telegram_frequency <> 'off' and not telegram_consent then raise exception 'Telegram consent required'; end if;
  if candidate_telegram_frequency <> 'off' and not exists (
    select 1 from public.telegram_links where user_id = current_user_id and status = 'active'
  ) then raise exception 'active Telegram link required'; end if;

  select granted into latest_email from public.user_consents
  where user_id = current_user_id and consent_type = 'email_notifications'
  order by recorded_at desc, id desc limit 1;
  select granted into latest_telegram from public.user_consents
  where user_id = current_user_id and consent_type = 'telegram_notifications'
  order by recorded_at desc, id desc limit 1;

  if latest_email is distinct from email_consent then
    insert into public.user_consents (user_id, policy_version, consent_type, granted, required, source)
    values (current_user_id, candidate_policy_version, 'email_notifications', email_consent, false, 'web');
  end if;
  if latest_telegram is distinct from telegram_consent then
    insert into public.user_consents (user_id, policy_version, consent_type, granted, required, source)
    values (current_user_id, candidate_policy_version, 'telegram_notifications', telegram_consent, false, 'web');
  end if;

  insert into public.notification_preferences (
    user_id, email_enabled, telegram_enabled, email_frequency, telegram_frequency,
    timezone_name, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, event_types
  ) values (
    current_user_id, candidate_email_frequency <> 'off', candidate_telegram_frequency <> 'off',
    candidate_email_frequency, candidate_telegram_frequency, candidate_timezone_name,
    candidate_quiet_hours_enabled, candidate_quiet_hours_start, candidate_quiet_hours_end,
    candidate_event_types
  ) on conflict (user_id) do update set
    email_enabled = excluded.email_enabled,
    telegram_enabled = excluded.telegram_enabled,
    email_frequency = excluded.email_frequency,
    telegram_frequency = excluded.telegram_frequency,
    timezone_name = excluded.timezone_name,
    quiet_hours_enabled = excluded.quiet_hours_enabled,
    quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end,
    event_types = excluded.event_types;

  if candidate_email_frequency <> 'off' then
    update public.notification_suppressions set active = false, released_at = timezone('utc', now())
    where user_id = current_user_id and channel = 'email' and active and reason = 'user_unsubscribed';
  end if;
  insert into public.audit_events (user_id, event_type, metadata)
  values (current_user_id, 'notification_preferences_updated', jsonb_build_object(
    'email_frequency', candidate_email_frequency, 'telegram_frequency', candidate_telegram_frequency
  ));
  return true;
end;
$$;

create or replace function public.phase11_unsubscribe_email(candidate_policy_version text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if char_length(candidate_policy_version) not between 1 and 80 then raise exception 'invalid policy version'; end if;
  update public.notification_preferences set email_enabled = false, email_frequency = 'off'
  where user_id = current_user_id;
  insert into public.user_consents (user_id, policy_version, consent_type, granted, required, source)
  values (current_user_id, candidate_policy_version, 'email_notifications', false, false, 'web');
  insert into public.notification_suppressions (user_id, channel, reason)
  values (current_user_id, 'email', 'user_unsubscribed')
  on conflict (user_id, channel) where active do nothing;
  insert into public.audit_events (user_id, event_type, metadata)
  values (current_user_id, 'email_unsubscribed', '{}'::jsonb);
  return true;
end;
$$;

create or replace function public.phase11_claim_notification_deliveries(
  worker_token uuid,
  batch_limit integer default 25,
  lease_seconds integer default 120
)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if worker_token is null or batch_limit not between 1 and 50 or lease_seconds not between 30 and 300 then
    raise exception 'invalid notification claim';
  end if;
  return query
  with candidates as (
    select d.id
    from public.notification_deliveries d
    where d.available_at <= timezone('utc', now())
      and (
        d.status in ('queued', 'scheduled', 'retry')
        or (d.status = 'sending' and d.lease_expires_at <= timezone('utc', now()))
      )
      and d.attempt_count < 5
    order by d.available_at, d.created_at, d.id
    limit batch_limit
    for update skip locked
  )
  update public.notification_deliveries d
  set status = 'sending', attempt_count = d.attempt_count + 1,
      lease_token = worker_token,
      lease_expires_at = timezone('utc', now()) + make_interval(secs => lease_seconds)
  from candidates c
  where d.id = c.id
  returning d.id;
end;
$$;

revoke all on function public.phase11_validate_delivery_owner() from public;
revoke all on function public.phase11_validate_attempt_owner() from public;
revoke all on function public.phase11_validate_telegram_preference() from public;
revoke all on function public.phase11_create_telegram_link_token(text) from public;
revoke all on function public.phase11_consume_telegram_link_token(text, text, text) from public;
revoke all on function public.phase11_unlink_telegram() from public;
revoke all on function public.phase11_save_notification_preferences(text, text, text, boolean, time, time, text[], boolean, boolean, text) from public;
revoke all on function public.phase11_unsubscribe_email(text) from public;
revoke all on function public.phase11_claim_notification_deliveries(uuid, integer, integer) from public;
grant execute on function public.phase11_create_telegram_link_token(text) to authenticated;
grant execute on function public.phase11_unlink_telegram() to authenticated;
grant execute on function public.phase11_save_notification_preferences(text, text, text, boolean, time, time, text[], boolean, boolean, text) to authenticated;
grant execute on function public.phase11_unsubscribe_email(text) to authenticated;
grant execute on function public.phase11_consume_telegram_link_token(text, text, text) to service_role;
grant execute on function public.phase11_claim_notification_deliveries(uuid, integer, integer) to service_role;

alter table public.telegram_links enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_delivery_attempts enable row level security;
alter table public.notification_suppressions enable row level security;

create policy telegram_links_select_own on public.telegram_links
  for select to authenticated using (user_id = auth.uid());
create policy notification_events_select_own on public.notification_events
  for select to authenticated using (user_id = auth.uid());
create policy notification_deliveries_select_own on public.notification_deliveries
  for select to authenticated using (user_id = auth.uid());
create policy notification_attempts_select_own on public.notification_delivery_attempts
  for select to authenticated using (user_id = auth.uid());
create policy notification_suppressions_select_own on public.notification_suppressions
  for select to authenticated using (user_id = auth.uid());

revoke all on public.telegram_links from anon, authenticated;
revoke all on public.telegram_link_tokens from anon, authenticated;
revoke all on public.notification_events from anon, authenticated;
revoke all on public.notification_deliveries from anon, authenticated;
revoke all on public.notification_delivery_attempts from anon, authenticated;
revoke all on public.notification_suppressions from anon, authenticated;
grant select on public.telegram_links to authenticated;
grant select on public.notification_events to authenticated;
grant select on public.notification_deliveries to authenticated;
grant select on public.notification_delivery_attempts to authenticated;
grant select on public.notification_suppressions to authenticated;

revoke update on public.notification_preferences from authenticated;
grant update (
  email_enabled, telegram_enabled, email_frequency, telegram_frequency,
  timezone_name, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, event_types
) on public.notification_preferences to authenticated;

alter table public.audit_events drop constraint if exists audit_events_type;
alter table public.audit_events add constraint audit_events_type check (event_type in (
  'account_registered', 'account_login', 'account_logout', 'account_logout_all',
  'email_verification_requested', 'password_recovery_requested', 'password_reset',
  'magic_link_requested', 'oauth_started', 'oauth_cancelled', 'consent_recorded',
  'data_export_requested', 'account_deletion_requested', 'account_deletion_cancelled',
  'application_status_changed', 'cv_analysis_completed', 'assistant_draft_generated',
  'assistant_draft_approved', 'assistant_draft_exported',
  'notification_preferences_updated', 'telegram_link_started', 'telegram_linked',
  'telegram_unlinked', 'email_unsubscribed'
));

comment on table public.telegram_links is 'Owner-visible Telegram destination metadata; bot credentials remain server-only.';
comment on table public.telegram_link_tokens is 'Server-only SHA-256 digests for expiring one-time Telegram links; plaintext tokens are never stored.';
comment on table public.notification_events is 'Private durable notification outbox with deterministic deduplication and closed deep links.';
comment on table public.notification_deliveries is 'Per-channel notification delivery state, leases, retries and safe provider metadata.';
comment on table public.notification_delivery_attempts is 'Append-oriented delivery attempt outcomes without message bodies or provider secrets.';
comment on table public.notification_suppressions is 'Server-managed delivery suppressions for user opt-out and provider safety signals.';
