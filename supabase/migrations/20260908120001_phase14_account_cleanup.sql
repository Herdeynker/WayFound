-- Preserve immutable analytics while allowing auth.users ON DELETE SET NULL cleanup.
create or replace function public.phase14_reject_immutable_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'product_analytics_events'
    and tg_op = 'UPDATE'
    and old.user_id is not null
    and new.user_id is null
    and new.id = old.id
    and new.event_type = old.event_type
    and new.idempotency_key = old.idempotency_key
    and new.properties = old.properties
    and new.occurred_at = old.occurred_at then
    return new;
  end if;
  raise exception 'Phase 14 event history is immutable';
end;
$$;

revoke all on function public.phase14_reject_immutable_change() from public, anon, authenticated;
