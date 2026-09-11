-- Forward-only repair: Supabase installs pgcrypto in the extensions schema.
-- Keep the verified-payment transaction deterministic while making digest resolvable.

alter function public.phase12_record_verified_payment(
  uuid, uuid, text, text, text, timestamptz, text, text, text, text
) set search_path = public, extensions;
