# Phase 9 requirement checklist

| Requirement | Implementation | Security / evidence | Status |
| --- | --- | --- | --- |
| Private document library and immutable versions | `document_metadata`, `document_versions`, document library route | Private `user-documents` storage, owner RLS, append-only update trigger | Complete |
| Categories, expiry and application usage links | Metadata fields and `application_document_links` | Owner-consistency policies and hosted link test | Complete |
| File validation and short-lived signed access | Document upload and signed-URL APIs | Extension, MIME signature, 10 MB limit, ownership, 60-second URL; unit and hosted expiry tests | Complete |
| Mobile camera/file upload | Responsive upload form with `capture="environment"` | 390×844 Playwright journey | Complete |
| Progress, cancellation and interrupted-upload recovery | XHR progress, abort control, safe session recovery metadata and idempotency-key reuse | No file bytes or contents stored in recovery state; cancellation/retry E2E | Complete |
| Application workspace from a safe match | `phase9_create_application_workspace` | Owned safe match required; unique workspace and idempotent RPC | Complete |
| Requirement-specific deterministic checklist | Opportunity-document mapping and stable `sort_order` | Hosted mapping assertion and desktop E2E order assertion | Complete |
| Internal/official deadlines | Application model and tracker | Database ordering constraint and hosted official-deadline assertion | Complete |
| Private notes, reminders and document links | Phase 9 application relations and APIs | Owner-only RLS; forged/cross-user writes denied | Complete |
| Canonical status lifecycle | Ten statuses and server transition RPC | Valid-transition checks, idempotency and owner enforcement | Complete |
| Durable status history and audit | `application_status_events` and `audit_events` | Rewrite denied; account cascade remains safe through corrective migrations | Complete |
| Anonymous and cross-user isolation | RLS on every Phase 9 user-owned table and private storage policies | Hosted anonymous, User A/User B, forged-owner and storage tests | Complete |
| Honest loading, empty, success, error, interrupted, completed and permission states | Deterministic test-only state fixtures and production components | Semantic status/alert regions and production-mode screenshots | Complete |
| Mobile and keyboard accessibility | Responsive Direction A surfaces, native labels, focus styles and touch-safe controls | Desktop/mobile Playwright, overflow and focus verification | Complete |
| Test-fixture cleanup and account deletion | Forward-only cascade compatibility repairs `20260908070003`–`20260908070006` | Hosted test cleans storage, users and owned relational fixtures | Complete |
| Production evidence | `tests/e2e/phase9-visual.spec.ts` through `next start` | Canonical desktop and 390×844 inventory under `artifacts/phase-9/` | Complete |
| Later-phase boundary | No drafting, AI generation, delivery, payments, IELTS or landing page | Scope and changed-file audit | Complete |
