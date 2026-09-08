# WAYFOUND Phase 3 checklist

Phase 3 implements the mobile-first Opportunity Passport only. Opportunity ingestion, matching and the marketing landing page remain out of scope.

| Requirement                                   | Implementation/evidence                                                                                                 | Status                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Multi-goal conditional onboarding             | `src/features/passport/model.ts`, `passport-wizard.tsx`, `tests/unit/passport.test.ts` and `tests/e2e/passport.spec.ts` | Implemented                           |
| Origin, destinations and progressive sections | Passport origin/destination sections and `visibleSections` rules                                                        | Implemented                           |
| Normalized confirmed profile records          | Phase 3 migration tables and `confirmPassport` service                                                                  | Implemented                           |
| Autosave, retry state and resume              | `onboarding_progress`, debounced PUT, visible saving/error state                                                        | Implemented                           |
| Deterministic completion                      | `src/server/passport/completion.ts`; pathway-specific missing requirements                                              | Implemented                           |
| Immutable profile snapshots                   | `profile_versions` insert-only policies and review confirmation                                                         | Implemented                           |
| Private basic CV upload                       | `document_metadata`, private `user-documents` bucket, MIME/signature/size checks                                        | Implemented                           |
| CV parsing boundary                           | Strict `cvSuggestionSchema`, consent check and honest disabled provider response                                        | Implemented                           |
| Phase 2 notification repair                   | Independent email/Telegram consent types; legacy combined rows preserved                                                | Implemented                           |
| RLS and storage isolation                     | Policies for every Phase 3 user-owned table and storage folder; live integration test                                   | Pending hosted migration verification |
| Visual evidence                               | `tests/e2e/phase3-visual.spec.ts`, `artifacts/phase-3/`                                                                 | Pending execution                     |
