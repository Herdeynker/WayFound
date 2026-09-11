-- Phase 12 forward-only repair: make successful payment replay a true no-op.
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
returns uuid language plpgsql security definer set search_path = public, extensions as $$
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

  select id into payment_id from public.billing_payments
  where provider = 'paystack' and provider_reference = checkout_row.provider_reference;
  if payment_id is not null then
    return payment_id;
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

revoke all on function public.phase12_record_verified_payment(uuid,uuid,text,text,text,timestamptz,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.phase12_record_verified_payment(uuid,uuid,text,text,text,timestamptz,text,text,text,text)
  to service_role;
