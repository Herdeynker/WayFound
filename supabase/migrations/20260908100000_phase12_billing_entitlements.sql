-- WAYFOUND Phase 12: versioned Paystack billing, verified payments,
-- subscriptions, entitlements, usage metering and reconciliation.

create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plans_code check (code ~ '^[a-z][a-z0-9_]{1,31}$'),
  constraint billing_plans_sort check (sort_order between 0 and 1000)
);

create table public.billing_price_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.billing_plans(id),
  version_code text not null,
  amount_kobo integer not null,
  currency text not null,
  interval text not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint billing_price_versions_unique unique (plan_id, version_code),
  constraint billing_price_versions_amount check (amount_kobo > 0),
  constraint billing_price_versions_currency check (currency = 'NGN'),
  constraint billing_price_versions_interval check (interval in ('weekly', 'monthly', 'annually')),
  constraint billing_price_versions_window check (valid_until is null or valid_until > valid_from)
);

create table public.billing_features (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  description text not null,
  metered boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint billing_features_code check (code ~ '^[a-z][a-z0-9_]{1,47}$')
);

create table public.billing_plan_features (
  plan_id uuid not null references public.billing_plans(id) on delete cascade,
  feature_id uuid not null references public.billing_features(id) on delete cascade,
  period_limit integer,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, feature_id),
  constraint billing_plan_features_limit check (period_limit is null or period_limit > 0)
);

create table public.billing_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  price_version_id uuid not null references public.billing_price_versions(id),
  internal_plan_code text not null,
  price_version_code text not null,
  provider text not null default 'paystack',
  provider_plan_code text not null,
  provider_reference text not null unique,
  idempotency_key uuid not null,
  amount_kobo integer not null,
  currency text not null,
  interval text not null,
  status text not null default 'created',
  callback_path text not null default '/billing/callback',
  authorization_url text,
  initialized_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_checkout_user_idempotency unique (user_id, idempotency_key),
  constraint billing_checkout_plan check (internal_plan_code in ('weekly', 'monthly', 'yearly')),
  constraint billing_checkout_provider check (provider = 'paystack'),
  constraint billing_checkout_reference check (provider_reference ~ '^[A-Za-z0-9.=\-]{16,100}$'),
  constraint billing_checkout_amount check (amount_kobo > 0),
  constraint billing_checkout_currency check (currency = 'NGN'),
  constraint billing_checkout_interval check (interval in ('weekly', 'monthly', 'annually')),
  constraint billing_checkout_status check (status in ('created', 'initialized', 'verified', 'failed', 'expired')),
  constraint billing_checkout_callback check (callback_path = '/billing/callback'),
  constraint billing_checkout_authorization_url check (
    authorization_url is null or authorization_url ~ '^https://checkout\\.paystack\\.com/'
  ),
  constraint billing_checkout_failure check (failure_code is null or length(failure_code) between 1 and 80)
);

create index billing_checkout_user_status_idx
  on public.billing_checkout_intents(user_id, status, created_at desc);

create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider text not null default 'paystack',
  provider_customer_code text not null unique,
  email_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customers_provider check (provider = 'paystack'),
  constraint billing_customers_email_fingerprint check (email_fingerprint ~ '^[a-f0-9]{64}$')
);

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_intent_id uuid references public.billing_checkout_intents(id),
  plan_id uuid not null references public.billing_plans(id),
  price_version_id uuid not null references public.billing_price_versions(id),
  internal_plan_code text not null,
  price_version_code text not null,
  provider text not null default 'paystack',
  provider_customer_code text,
  provider_subscription_code text,
  provider_plan_code text not null,
  status text not null default 'pending',
  provider_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_payment_at timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  ended_at timestamptz,
  last_successful_payment_at timestamptz,
  last_failed_payment_at timestamptz,
  last_provider_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_checkout unique (checkout_intent_id),
  constraint billing_subscriptions_plan check (internal_plan_code in ('weekly', 'monthly', 'yearly')),
  constraint billing_subscriptions_provider check (provider = 'paystack'),
  constraint billing_subscriptions_status check (
    status in ('pending', 'active', 'non_renewing', 'attention', 'past_due', 'cancelled', 'completed', 'expired')
  ),
  constraint billing_subscriptions_period check (
    current_period_end is null or current_period_start is null or current_period_end > current_period_start
  )
);

create unique index billing_subscriptions_provider_code_unique
  on public.billing_subscriptions(provider, provider_subscription_code)
  where provider_subscription_code is not null;
create index billing_subscriptions_user_status_idx
  on public.billing_subscriptions(user_id, status, current_period_end desc);

create table public.billing_subscription_secrets (
  subscription_id uuid primary key references public.billing_subscriptions(id) on delete cascade,
  provider_email_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscription_secret_length check (length(provider_email_token) between 6 and 300)
);

create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.billing_subscriptions(id),
  checkout_intent_id uuid references public.billing_checkout_intents(id),
  plan_id uuid not null references public.billing_plans(id),
  price_version_id uuid not null references public.billing_price_versions(id),
  internal_plan_code text not null,
  price_version_code text not null,
  provider text not null default 'paystack',
  provider_reference text not null,
  provider_transaction_id text not null,
  amount_kobo integer not null,
  currency text not null,
  status text not null,
  paid_at timestamptz,
  provider_customer_code text,
  authorization_channel text,
  authorization_brand text,
  authorization_last4 text,
  event_fingerprint text,
  created_at timestamptz not null default now(),
  constraint billing_payments_provider_reference unique (provider, provider_reference),
  constraint billing_payments_provider_transaction unique (provider, provider_transaction_id),
  constraint billing_payments_plan check (internal_plan_code in ('weekly', 'monthly', 'yearly')),
  constraint billing_payments_provider check (provider = 'paystack'),
  constraint billing_payments_amount check (amount_kobo > 0),
  constraint billing_payments_currency check (currency = 'NGN'),
  constraint billing_payments_status check (status in ('succeeded', 'failed', 'refunded', 'reversed')),
  constraint billing_payments_last4 check (authorization_last4 is null or authorization_last4 ~ '^[0-9]{4}$'),
  constraint billing_payments_event_fingerprint check (
    event_fingerprint is null or event_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

create index billing_payments_user_paid_idx on public.billing_payments(user_id, paid_at desc);

create table public.billing_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.billing_plans(id),
  price_version_id uuid not null references public.billing_price_versions(id),
  source_payment_id uuid not null unique references public.billing_payments(id),
  source_subscription_id uuid references public.billing_subscriptions(id),
  internal_plan_code text not null,
  price_version_code text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active',
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_entitlements_plan check (internal_plan_code in ('weekly', 'monthly', 'yearly')),
  constraint billing_entitlements_period check (ends_at > starts_at),
  constraint billing_entitlements_status check (status in ('active', 'expired', 'revoked')),
  constraint billing_entitlements_revocation check (
    (status <> 'revoked' and revoked_at is null and revocation_reason is null)
    or (status = 'revoked' and revoked_at is not null and length(revocation_reason) between 1 and 120)
  )
);

create index billing_entitlements_user_active_idx
  on public.billing_entitlements(user_id, ends_at desc) where status = 'active';

create table public.billing_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_id uuid not null references public.billing_entitlements(id) on delete cascade,
  feature_id uuid not null references public.billing_features(id),
  quantity integer not null,
  idempotency_key uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint billing_usage_user_idempotency unique (user_id, feature_id, idempotency_key),
  constraint billing_usage_quantity check (quantity between 1 and 100),
  constraint billing_usage_metadata check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048)
);

create index billing_usage_period_idx
  on public.billing_usage_ledger(entitlement_id, feature_id, occurred_at);

create table public.billing_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack',
  event_type text not null,
  event_fingerprint text not null unique,
  provider_reference text,
  provider_subscription_code text,
  provider_customer_code text,
  occurred_at timestamptz not null,
  safe_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  processed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_events_provider check (provider = 'paystack'),
  constraint billing_events_type check (length(event_type) between 3 and 80),
  constraint billing_events_fingerprint check (event_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint billing_events_safe_data check (jsonb_typeof(safe_data) = 'object' and pg_column_size(safe_data) <= 8192),
  constraint billing_events_status check (status in ('pending', 'processing', 'processed', 'ignored', 'retry', 'failed')),
  constraint billing_events_attempt check (attempt_count between 0 and 10),
  constraint billing_events_failure check (failure_code is null or length(failure_code) between 1 and 80)
);

create index billing_events_work_idx on public.billing_provider_events(status, available_at, created_at);

create table public.billing_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  status text not null default 'running',
  checked_count integer not null default 0,
  repaired_count integer not null default 0,
  failure_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_code text,
  constraint billing_reconciliation_key check (length(idempotency_key) between 8 and 120),
  constraint billing_reconciliation_status check (status in ('running', 'completed', 'partial', 'failed')),
  constraint billing_reconciliation_counts check (checked_count >= 0 and repaired_count >= 0 and failure_count >= 0)
);

-- Future-safe canonical promo/referral boundary. There are no active codes,
-- discounts, credits, payouts or browser-facing redemption paths in Phase 12.
create table public.billing_adjustment_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  kind text not null,
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_adjustment_hash check (code_hash ~ '^[a-f0-9]{64}$'),
  constraint billing_adjustment_kind check (kind in ('promotion', 'referral_attribution')),
  constraint billing_adjustment_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create or replace function public.phase12_validate_price_overlap()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from public.billing_price_versions p
    where p.plan_id = new.plan_id and p.currency = new.currency and p.id <> new.id
      and p.enabled and new.enabled
      and tstzrange(p.valid_from, p.valid_until, '[)') && tstzrange(new.valid_from, new.valid_until, '[)')
  ) then raise exception 'active price versions may not overlap'; end if;
  return new;
end;
$$;

create trigger phase12_price_overlap before insert or update on public.billing_price_versions
for each row execute function public.phase12_validate_price_overlap();

create or replace function public.phase12_protect_price_history()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.billing_checkout_intents where price_version_id = old.id)
    and (new.plan_id, new.version_code, new.amount_kobo, new.currency, new.interval, new.valid_from)
      is distinct from
        (old.plan_id, old.version_code, old.amount_kobo, old.currency, old.interval, old.valid_from)
  then raise exception 'accepted price history is immutable'; end if;
  return new;
end;
$$;

create trigger phase12_price_history before update on public.billing_price_versions
for each row execute function public.phase12_protect_price_history();

do $$ declare table_name text;
begin
  foreach table_name in array array[
    'billing_plans','billing_plan_features','billing_checkout_intents','billing_customers',
    'billing_subscriptions','billing_subscription_secrets','billing_entitlements','billing_provider_events'
  ] loop
    execute format('create trigger phase12_updated_at before update on public.%I for each row execute function public.phase2_set_updated_at()', table_name);
  end loop;
end $$;

insert into public.billing_plans(code, display_name, description, sort_order)
values
  ('weekly', 'Weekly', 'Full WAYFOUND paid access, renewed weekly.', 10),
  ('monthly', 'Monthly', 'Full WAYFOUND paid access, renewed monthly.', 20),
  ('yearly', 'Yearly', 'Full WAYFOUND paid access, renewed annually.', 30);

insert into public.billing_price_versions(plan_id, version_code, amount_kobo, currency, interval, valid_from)
select id, 'launch-2026-09',
  case code when 'weekly' then 700000 when 'monthly' then 2000000 else 8000000 end,
  'NGN', case code when 'yearly' then 'annually' else code end,
  '2026-09-08T00:00:00Z'::timestamptz
from public.billing_plans;

insert into public.billing_features(code, display_name, description)
values
  ('advanced_matches', 'Advanced matches', 'Explainable advanced opportunity matching and readiness usage.'),
  ('cv_analysis', 'CV analysis', 'Role-specific CV analysis usage.'),
  ('ai_documents', 'AI application documents', 'Evidence-grounded drafting usage.'),
  ('premium_alerts', 'Premium alerts', 'High-value match and application alert delivery usage.');

insert into public.billing_plan_features(plan_id, feature_id, period_limit)
select p.id, f.id,
  case f.code when 'ai_documents' then 30 when 'cv_analysis' then 100 else 1000 end
from public.billing_plans p cross join public.billing_features f;

create or replace function public.phase12_consume_usage(
  candidate_feature_code text,
  candidate_quantity integer,
  candidate_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid := auth.uid();
  chosen_entitlement public.billing_entitlements;
  chosen_feature public.billing_features;
  configured_limit integer;
  already_used bigint;
  existing_entry public.billing_usage_ledger;
  inserted_entry public.billing_usage_ledger;
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  if candidate_quantity is null or candidate_quantity < 1 or candidate_quantity > 100 then
    raise exception 'invalid usage quantity';
  end if;

  select * into chosen_entitlement from public.billing_entitlements
  where user_id = owner_id and status = 'active' and starts_at <= now() and ends_at > now()
  order by ends_at desc limit 1 for update;
  if chosen_entitlement.id is null then raise exception 'paid entitlement required'; end if;

  select f.* into chosen_feature
  from public.billing_features f
  join public.billing_plan_features pf on pf.feature_id = f.id
  where f.code = candidate_feature_code and f.enabled and pf.enabled
    and pf.plan_id = chosen_entitlement.plan_id;
  if chosen_feature.id is null then raise exception 'feature is not entitled'; end if;
  select pf.period_limit into configured_limit from public.billing_plan_features pf
  where pf.plan_id = chosen_entitlement.plan_id and pf.feature_id = chosen_feature.id and pf.enabled;

  select * into existing_entry from public.billing_usage_ledger
  where user_id = owner_id and feature_id = chosen_feature.id and idempotency_key = candidate_idempotency_key;
  if existing_entry.id is not null then
    return jsonb_build_object('id', existing_entry.id, 'duplicate', true, 'remaining',
      case when configured_limit is null then null else greatest(0, configured_limit - existing_entry.quantity) end);
  end if;

  select coalesce(sum(quantity), 0) into already_used from public.billing_usage_ledger
  where entitlement_id = chosen_entitlement.id and feature_id = chosen_feature.id
    and occurred_at >= chosen_entitlement.starts_at and occurred_at < chosen_entitlement.ends_at;
  if configured_limit is not null and already_used + candidate_quantity > configured_limit then
    raise exception 'usage limit reached';
  end if;

  insert into public.billing_usage_ledger(user_id, entitlement_id, feature_id, quantity, idempotency_key)
  values(owner_id, chosen_entitlement.id, chosen_feature.id, candidate_quantity, candidate_idempotency_key)
  returning * into inserted_entry;
  return jsonb_build_object('id', inserted_entry.id, 'duplicate', false, 'remaining',
    case when configured_limit is null then null else configured_limit - already_used - candidate_quantity end);
end;
$$;

create or replace function public.phase12_record_verified_payment(
  candidate_user_id uuid,
  candidate_checkout_intent_id uuid,
  candidate_provider_transaction_id text,
  candidate_provider_customer_code text,
  candidate_provider_subscription_code text,
  candidate_paid_at timestamptz,
  candidate_authorization_channel text default null,
  candidate_authorization_brand text default null,
  candidate_authorization_last4 text default null,
  candidate_event_fingerprint text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  checkout_row public.billing_checkout_intents;
  price_row public.billing_price_versions;
  plan_row public.billing_plans;
  payment_id uuid;
  subscription_id uuid;
  calculated_end timestamptz;
begin
  select * into checkout_row from public.billing_checkout_intents
  where id = candidate_checkout_intent_id and user_id = candidate_user_id for update;
  if checkout_row.id is null or checkout_row.status not in ('created','initialized','verified') then
    raise exception 'checkout intent is unavailable';
  end if;
  select * into price_row from public.billing_price_versions where id = checkout_row.price_version_id;
  select * into plan_row from public.billing_plans where id = price_row.plan_id;
  if price_row.amount_kobo <> checkout_row.amount_kobo or price_row.currency <> checkout_row.currency
    or price_row.interval <> checkout_row.interval or plan_row.code <> checkout_row.internal_plan_code then
    raise exception 'checkout price snapshot mismatch';
  end if;
  if candidate_paid_at is null or candidate_paid_at > now() + interval '5 minutes' then
    raise exception 'invalid payment time';
  end if;
  calculated_end := case price_row.interval
    when 'weekly' then candidate_paid_at + interval '7 days'
    when 'monthly' then candidate_paid_at + interval '1 month'
    when 'annually' then candidate_paid_at + interval '1 year'
  end;

  insert into public.billing_customers(user_id, provider_customer_code, email_fingerprint)
  values(candidate_user_id, candidate_provider_customer_code, encode(digest(candidate_user_id::text, 'sha256'), 'hex'))
  on conflict (user_id) do update set provider_customer_code = excluded.provider_customer_code;

  select id into subscription_id from public.billing_subscriptions
  where checkout_intent_id = checkout_row.id;
  if subscription_id is null then
    insert into public.billing_subscriptions(
      user_id, checkout_intent_id, plan_id, price_version_id, internal_plan_code, price_version_code,
      provider_customer_code, provider_subscription_code, provider_plan_code, status,
      current_period_start, current_period_end, next_payment_at, last_successful_payment_at
    ) values(
      candidate_user_id, checkout_row.id, plan_row.id, price_row.id, plan_row.code, price_row.version_code,
      candidate_provider_customer_code, nullif(candidate_provider_subscription_code, ''), checkout_row.provider_plan_code,
      'active', candidate_paid_at, calculated_end, calculated_end, candidate_paid_at
    ) returning id into subscription_id;
  else
    update public.billing_subscriptions set
      provider_customer_code = candidate_provider_customer_code,
      provider_subscription_code = coalesce(nullif(candidate_provider_subscription_code, ''), provider_subscription_code),
      status = case when cancel_at_period_end then 'non_renewing' else 'active' end,
      current_period_start = greatest(coalesce(current_period_start, candidate_paid_at), candidate_paid_at),
      current_period_end = greatest(coalesce(current_period_end, calculated_end), calculated_end),
      next_payment_at = case when cancel_at_period_end then null else calculated_end end,
      last_successful_payment_at = greatest(coalesce(last_successful_payment_at, candidate_paid_at), candidate_paid_at)
    where id = subscription_id;
  end if;

  insert into public.billing_payments(
    user_id, subscription_id, checkout_intent_id, plan_id, price_version_id, internal_plan_code,
    price_version_code, provider_reference, provider_transaction_id, amount_kobo, currency, status,
    paid_at, provider_customer_code, authorization_channel, authorization_brand, authorization_last4,
    event_fingerprint
  ) values(
    candidate_user_id, subscription_id, checkout_row.id, plan_row.id, price_row.id, plan_row.code,
    price_row.version_code, checkout_row.provider_reference, candidate_provider_transaction_id,
    price_row.amount_kobo, price_row.currency, 'succeeded', candidate_paid_at, candidate_provider_customer_code,
    left(nullif(candidate_authorization_channel, ''), 40), left(nullif(candidate_authorization_brand, ''), 40),
    nullif(candidate_authorization_last4, ''), candidate_event_fingerprint
  ) on conflict (provider, provider_reference) do nothing returning id into payment_id;

  if payment_id is null then
    select id into payment_id from public.billing_payments
    where provider = 'paystack' and provider_reference = checkout_row.provider_reference;
    return payment_id;
  end if;

  insert into public.billing_entitlements(
    user_id, plan_id, price_version_id, source_payment_id, source_subscription_id,
    internal_plan_code, price_version_code, starts_at, ends_at
  ) values(
    candidate_user_id, plan_row.id, price_row.id, payment_id, subscription_id,
    plan_row.code, price_row.version_code, candidate_paid_at, calculated_end
  ) on conflict (source_payment_id) do nothing;

  update public.billing_checkout_intents set status = 'verified', verified_at = now(), failure_code = null
  where id = checkout_row.id;
  return payment_id;
end;
$$;

create or replace function public.phase12_claim_provider_events(
  worker_token uuid,
  batch_limit integer default 20,
  lease_seconds integer default 120
)
returns setof uuid language plpgsql security definer set search_path = public as $$
begin
  if batch_limit < 1 or batch_limit > 50 or lease_seconds < 30 or lease_seconds > 600 then
    raise exception 'invalid claim bounds';
  end if;
  return query with candidates as (
    select id from public.billing_provider_events
    where status in ('pending','retry') and available_at <= now()
      and (lease_expires_at is null or lease_expires_at < now())
    order by occurred_at, created_at for update skip locked limit batch_limit
  ) update public.billing_provider_events e set
    status = 'processing', lease_token = worker_token,
    lease_expires_at = now() + make_interval(secs => lease_seconds), attempt_count = attempt_count + 1
  from candidates c where e.id = c.id returning e.id;
end;
$$;

create or replace function public.phase12_expire_entitlements()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  update public.billing_entitlements set status = 'expired'
  where status = 'active' and ends_at <= now();
  get diagnostics affected = row_count;
  update public.billing_subscriptions s set status = 'expired', ended_at = coalesce(ended_at, now()), next_payment_at = null
  where status in ('active','non_renewing','attention','past_due')
    and current_period_end <= now()
    and not exists (
      select 1 from public.billing_entitlements e
      where e.user_id = s.user_id and e.status = 'active' and e.ends_at > now()
    );
  return affected;
end;
$$;

alter table public.billing_plans enable row level security;
alter table public.billing_price_versions enable row level security;
alter table public.billing_features enable row level security;
alter table public.billing_plan_features enable row level security;
alter table public.billing_checkout_intents enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_subscription_secrets enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_entitlements enable row level security;
alter table public.billing_usage_ledger enable row level security;
alter table public.billing_provider_events enable row level security;
alter table public.billing_reconciliation_runs enable row level security;
alter table public.billing_adjustment_codes enable row level security;

create policy billing_checkout_select_own on public.billing_checkout_intents
for select to authenticated using (user_id = auth.uid());
create policy billing_subscriptions_select_own on public.billing_subscriptions
for select to authenticated using (user_id = auth.uid());
create policy billing_payments_select_own on public.billing_payments
for select to authenticated using (user_id = auth.uid());
create policy billing_entitlements_select_own on public.billing_entitlements
for select to authenticated using (user_id = auth.uid());
create policy billing_usage_select_own on public.billing_usage_ledger
for select to authenticated using (user_id = auth.uid());

revoke all on public.billing_plans, public.billing_price_versions, public.billing_features,
  public.billing_plan_features, public.billing_checkout_intents, public.billing_customers,
  public.billing_subscriptions, public.billing_subscription_secrets, public.billing_payments,
  public.billing_entitlements, public.billing_usage_ledger, public.billing_provider_events,
  public.billing_reconciliation_runs, public.billing_adjustment_codes from anon;
revoke all on public.billing_plans, public.billing_price_versions, public.billing_features,
  public.billing_plan_features, public.billing_checkout_intents, public.billing_customers,
  public.billing_subscriptions, public.billing_subscription_secrets, public.billing_payments,
  public.billing_entitlements, public.billing_usage_ledger, public.billing_provider_events,
  public.billing_reconciliation_runs, public.billing_adjustment_codes from authenticated;
grant select on public.billing_checkout_intents, public.billing_subscriptions, public.billing_payments,
  public.billing_entitlements, public.billing_usage_ledger to authenticated;

revoke all on function public.phase12_validate_price_overlap() from public, anon, authenticated;
revoke all on function public.phase12_protect_price_history() from public, anon, authenticated;
revoke all on function public.phase12_record_verified_payment(uuid,uuid,text,text,text,timestamptz,text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.phase12_claim_provider_events(uuid,integer,integer) from public, anon, authenticated;
revoke all on function public.phase12_expire_entitlements() from public, anon, authenticated;
revoke all on function public.phase12_consume_usage(text,integer,uuid) from public, anon;
grant execute on function public.phase12_consume_usage(text,integer,uuid) to authenticated;
grant execute on function public.phase12_record_verified_payment(uuid,uuid,text,text,text,timestamptz,text,text,text,text)
  to service_role;
grant execute on function public.phase12_claim_provider_events(uuid,integer,integer) to service_role;
grant execute on function public.phase12_expire_entitlements() to service_role;

comment on table public.billing_price_versions is 'Immutable accepted launch price snapshots; future price changes require a new version.';
comment on table public.billing_provider_events is 'Minimal normalized signed Paystack event inbox; raw payment payloads and card data are never stored.';
comment on table public.billing_adjustment_codes is 'Inactive future-safe promo/referral boundary only; Phase 12 exposes no redemption, discount or payout workflow.';
