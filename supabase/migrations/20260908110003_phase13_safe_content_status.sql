-- Phase 13 forward-only correction: security-invoker safe content views need
-- permission to evaluate the governed publication status predicate. Answer keys
-- remain excluded from authenticated column privileges.

grant select (status) on public.ielts_content_items to authenticated;

comment on view public.safe_active_ielts_content is
  'Approved active practice projection. Authenticated readers may evaluate publication status but cannot read answer keys.';
