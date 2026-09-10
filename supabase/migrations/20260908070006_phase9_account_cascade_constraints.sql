-- Phase 9 corrective migration: remove cross-cascade RESTRICT races that can
-- block a user's account deletion while retaining ownership and history rules.

alter table public.match_evaluations
  drop constraint if exists match_evaluations_profile_version_id_fkey,
  add constraint match_evaluations_profile_version_id_fkey
    foreign key (profile_version_id) references public.profile_versions(id) on delete cascade;

alter table public.application_status_events
  drop constraint if exists application_status_events_application_id_fkey,
  add constraint application_status_events_application_id_fkey
    foreign key (application_id) references public.applications(id) on delete cascade;

alter table public.application_document_links
  drop constraint if exists application_document_links_document_version_id_fkey,
  add constraint application_document_links_document_version_id_fkey
    foreign key (document_version_id) references public.document_versions(id) on delete cascade;

comment on constraint match_evaluations_profile_version_id_fkey on public.match_evaluations is
  'A match is derived from a profile version and is removed when that owned version is removed.';

comment on constraint application_status_events_application_id_fkey on public.application_status_events is
  'Status history is retained with its application and removed only with the owning application/account.';

comment on constraint application_document_links_document_version_id_fkey on public.application_document_links is
  'Usage links are removed with an account-owned document version; document history remains otherwise immutable.';
