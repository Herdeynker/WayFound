-- Phase 9 corrective migration: retain append-only client behavior while
-- allowing auth-user and parent-record cascade deletion to complete.
-- Ordinary clients still have no DELETE grant or DELETE policy on either table.

drop trigger if exists phase9_document_versions_immutable on public.document_versions;
create trigger phase9_document_versions_immutable
  before update on public.document_versions
  for each row execute function public.phase9_document_versions_immutable();

drop trigger if exists phase9_status_events_immutable on public.application_status_events;
create trigger phase9_status_events_immutable
  before update on public.application_status_events
  for each row execute function public.phase9_immutable_status_event();

comment on function public.phase9_document_versions_immutable() is
  'Blocks version rewrites; deletion remains unavailable to ordinary clients through grants and RLS while account cascades may complete.';

comment on function public.phase9_immutable_status_event() is
  'Blocks status-history rewrites; deletion remains unavailable to ordinary clients through grants and RLS while account cascades may complete.';
