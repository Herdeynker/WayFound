-- Service-only companion to the owner-scoped usage RPC. This lets trusted
-- workers meter premium delivery without impersonating a browser session.

create or replace function public.phase12_consume_usage_for_user(
  candidate_user_id uuid,
  candidate_feature_code text,
  candidate_quantity integer,
  candidate_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  chosen_entitlement public.billing_entitlements;
  chosen_feature public.billing_features;
  configured_limit integer;
  already_used bigint;
  existing_entry public.billing_usage_ledger;
  inserted_entry public.billing_usage_ledger;
begin
  if candidate_user_id is null or candidate_quantity is null or candidate_quantity < 1 or candidate_quantity > 100 then
    raise exception 'invalid usage request';
  end if;
  select * into chosen_entitlement from public.billing_entitlements
  where user_id = candidate_user_id and status = 'active' and starts_at <= now() and ends_at > now()
  order by ends_at desc limit 1 for update;
  if chosen_entitlement.id is null then raise exception 'paid entitlement required'; end if;

  select f.* into chosen_feature from public.billing_features f
  join public.billing_plan_features pf on pf.feature_id = f.id
  where f.code = candidate_feature_code and f.enabled and pf.enabled
    and pf.plan_id = chosen_entitlement.plan_id;
  if chosen_feature.id is null then raise exception 'feature is not entitled'; end if;
  select pf.period_limit into configured_limit from public.billing_plan_features pf
  where pf.plan_id = chosen_entitlement.plan_id and pf.feature_id = chosen_feature.id and pf.enabled;

  select * into existing_entry from public.billing_usage_ledger
  where user_id = candidate_user_id and feature_id = chosen_feature.id
    and idempotency_key = candidate_idempotency_key;
  if existing_entry.id is not null then
    return jsonb_build_object('id', existing_entry.id, 'duplicate', true);
  end if;
  select coalesce(sum(quantity), 0) into already_used from public.billing_usage_ledger
  where entitlement_id = chosen_entitlement.id and feature_id = chosen_feature.id
    and occurred_at >= chosen_entitlement.starts_at and occurred_at < chosen_entitlement.ends_at;
  if configured_limit is not null and already_used + candidate_quantity > configured_limit then
    raise exception 'usage limit reached';
  end if;
  insert into public.billing_usage_ledger(user_id, entitlement_id, feature_id, quantity, idempotency_key)
  values(candidate_user_id, chosen_entitlement.id, chosen_feature.id, candidate_quantity, candidate_idempotency_key)
  returning * into inserted_entry;
  return jsonb_build_object('id', inserted_entry.id, 'duplicate', false);
end;
$$;

revoke all on function public.phase12_consume_usage_for_user(uuid,text,integer,uuid)
  from public, anon, authenticated;
grant execute on function public.phase12_consume_usage_for_user(uuid,text,integer,uuid)
  to service_role;
