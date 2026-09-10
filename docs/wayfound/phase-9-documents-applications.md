# Phase 9 — Documents and applications

## Confirmed scope

Phase 9 turns a safe, owned opportunity match into a private preparation workspace. It adds a private document library with immutable versions, metadata and short-lived access; requirement-specific application checklists; internal and official deadlines; private notes; reminder schedules; and an auditable application-status lifecycle.

It does not draft or submit applications, send reminders, recalculate matches, crawl sources, take payments, provide IELTS practice or add a marketing landing page. Those remain later-phase concerns.

## Architecture and data model

The browser uses authenticated Next.js routes. Routes derive the owner from the session, validate inputs with bounded schemas and call Supabase through the user's authenticated server client. The Phase 9 tables are `document_versions`, `applications`, `application_checklist_items`, `application_document_links`, `application_notes`, `application_status_events` and `application_reminders`; `document_metadata` remains the parent library record established in Phase 3.

Workspace creation is idempotent by user and opportunity. The server-owned RPC accepts an owned match only when its opportunity remains in the safe active publication view, copies the official deadline and builds a deterministic checklist from normalized opportunity-document requirements. Status changes follow the canonical lifecycle and create immutable history plus a durable audit event.

## Security, privacy and recovery

Every Phase 9 user-owned table has RLS enabled. Anonymous access is revoked. Owner policies, owner-consistency triggers and server-owned RPCs prevent cross-user reads, forged identifiers and unauthorized status changes. The `user-documents` bucket stays private; document access uses an owner-checked signed URL with a 60-second lifetime. File validation checks extension, declared MIME, file signature and a 10 MB maximum before storage.

Document version and status-history rows cannot be rewritten by ordinary clients. Corrective migrations keep those rewrite controls while allowing authorized account-deletion cascades and deterministic test cleanup. No document body, file bytes, provider error or credential is logged or sent to analytics.

The mobile uploader reports progress and offers cancellation. A same-session interrupted request retains only bounded metadata and the idempotency key; it never stores file contents. The user must choose the private file again before retrying. The server removes an uploaded object if version persistence fails and reports partial recovery honestly if the final parent-pointer update fails.

## User experience and accessibility

The document library, application list and workspace use the Direction A navy, teal, amber, type and card language. Desktop and 390×844 layouts are responsive without horizontal overflow. Native labels, semantic headings, status/alert live regions, keyboard-focus styling and reachable controls are verified. Deterministic non-production states cover loading, empty, success, error, interrupted upload, completed application and permission denial without presenting fixtures as real activity.

## Operations and testing

No external provider or background delivery is activated in Phase 9. Reminder rows are schedules only; delivery belongs to Phase 11.

Unit coverage validates file rules and lifecycle transitions. Component coverage verifies private wording and explicit states. Playwright covers deterministic checklist order, workspace navigation, camera/file selection, cancellation, retry, focus and mobile overflow. Hosted integration covers anonymous denial, User A/User B isolation, forged ownership, private object access, signed-link expiry, immutable history, idempotency, checklist mapping, reminders, document usage links and complete fixture cleanup. Production evidence is generated from `next start` under `artifacts/phase-9/`.
