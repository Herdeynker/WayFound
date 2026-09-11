-- Phase 13 forward-only hardening: authenticated practice clients may read the
-- governed content projection but never the deterministic reading answer keys.

revoke all on public.ielts_content_items from authenticated;
grant select (
  id, slug, test_type, skill, activity_kind, title, instructions,
  duration_seconds, content, rubric, provenance_type, provenance_title,
  provenance_author, provenance_url, licence_status, content_version
) on public.ielts_content_items to authenticated;

comment on view public.safe_active_ielts_content is
  'Approved active practice projection. Reading answer keys remain server-only through column privileges.';
