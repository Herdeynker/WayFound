-- Phase 10 forward-only cleanup compatibility. Immutable history remains
-- protected while same-transaction account deletion may cascade all owned rows.

alter table public.cv_analyses
  drop constraint cv_analyses_document_id_fkey,
  add constraint cv_analyses_document_id_fkey foreign key (document_id)
    references public.document_metadata(id) on delete no action deferrable initially deferred,
  drop constraint cv_analyses_document_version_id_fkey,
  add constraint cv_analyses_document_version_id_fkey foreign key (document_version_id)
    references public.document_versions(id) on delete no action deferrable initially deferred,
  drop constraint cv_analyses_profile_version_id_fkey,
  add constraint cv_analyses_profile_version_id_fkey foreign key (profile_version_id)
    references public.profile_versions(id) on delete no action deferrable initially deferred;

alter table public.assistant_drafts
  drop constraint assistant_drafts_fact_set_id_fkey,
  add constraint assistant_drafts_fact_set_id_fkey foreign key (fact_set_id)
    references public.assistant_fact_sets(id) on delete no action deferrable initially deferred,
  drop constraint assistant_drafts_current_revision_fkey,
  add constraint assistant_drafts_current_revision_fkey foreign key (current_revision_id, id)
    references public.assistant_draft_revisions(id, draft_id) on delete no action deferrable initially deferred,
  drop constraint assistant_drafts_approved_revision_fkey,
  add constraint assistant_drafts_approved_revision_fkey foreign key (approved_revision_id, id)
    references public.assistant_draft_revisions(id, draft_id) on delete no action deferrable initially deferred;

alter table public.assistant_draft_revisions
  drop constraint assistant_draft_revisions_generation_request_id_fkey,
  add constraint assistant_draft_revisions_generation_request_id_fkey foreign key (generation_request_id)
    references public.assistant_generation_requests(id) on delete no action deferrable initially deferred;

alter table public.assistant_usage_ledger
  drop constraint assistant_usage_ledger_generation_request_id_fkey,
  add constraint assistant_usage_ledger_generation_request_id_fkey foreign key (generation_request_id)
    references public.assistant_generation_requests(id) on delete no action deferrable initially deferred;

alter table public.assistant_exports
  drop constraint assistant_exports_revision_id_fkey,
  add constraint assistant_exports_revision_id_fkey foreign key (revision_id)
    references public.assistant_draft_revisions(id) on delete no action deferrable initially deferred;

