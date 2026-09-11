-- Keep worker and Telegram-token consumption RPCs exclusively server-side.
-- Supabase projects can carry explicit default function grants for API roles,
-- so revoke those roles in addition to PUBLIC before restoring service access.

revoke all on function public.phase11_consume_telegram_link_token(text, text, text)
  from public, anon, authenticated;
revoke all on function public.phase11_claim_notification_deliveries(uuid, integer, integer)
  from public, anon, authenticated;

grant execute on function public.phase11_consume_telegram_link_token(text, text, text)
  to service_role;
grant execute on function public.phase11_claim_notification_deliveries(uuid, integer, integer)
  to service_role;

