-- Phase 7 corrective hardening: the SECURITY DEFINER helper is for RLS policy
-- evaluation only. It must never be callable through the anonymous RPC surface.
revoke execute on function public.phase7_match_owner(uuid) from public, anon;
grant execute on function public.phase7_match_owner(uuid) to authenticated;

comment on function public.phase7_match_owner(uuid) is 'RLS-internal ownership lookup. Anonymous RPC execution is explicitly revoked.';
