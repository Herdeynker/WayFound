# Onboarding Optimization Requirements Checklist

Status legend: **Pass** is implemented and verified, **Pending gate** requires final hosted or production verification, and **Not applicable** is outside this corrective scope.

| Requirement | Implementation evidence | Verification |
| --- | --- | --- |
| Four visible stages only | `onboardingStageIds`, `PassportWizard` | Unit, component, E2E, visual |
| Approximately 8–12 essential answers | `calculateActivation` and pathway forms | Unit and pathway journeys |
| Separate onboarding progress and Passport readiness | `stageProgress`, `calculateCompletion`, `passport_readiness` | Component, hosted transaction |
| Single and multi-goal conditionals | `pathwayFlags`, conditional cards | Unit, component, E2E |
| Shared questions deduplicated | common background and `SkillsEditor` | Component and E2E |
| Goal removal hides but retains data | immutable state arrays and conditional render | Component/E2E regression |
| Optional enrichment deferred | Experience disclosure cards and review deferred list | Component, visual |
| No required CV/document upload | no document step in activation | E2E and visual |
| Unknown/false/zero/N/A remain distinct | nullable schemas, explicit trade options | Unit and hosted persistence |
| Legacy draft compatibility | `mapLegacySectionToStage` | Unit, component resume, hosted draft test |
| Honest autosave and retry | 700ms debounce, server baseline, visible failure | Component and E2E |
| Cross-device server resume | `onboarding_progress.draft` | Hosted persistence |
| No empty overwrite on load failure | `canAutosave` guard | Component regression |
| Transactional confirmation | `phase16_confirm_onboarding` | Hosted integration |
| Equivalent snapshot reuse | latest fingerprint comparison | Unit material fingerprint + hosted integration |
| Material edit versioning | canonical snapshot and new profile version | Hosted integration |
| Match supersession and regeneration | latest-version feed filter + idempotent queue | Hosted integration and query regression |
| Consent enforced | page/API guards and SQL RPC check | Integration/security regression |
| Payment gate preserved | existing checkout and entitlement guards | Existing Phase 12 tests + E2E |
| Completed user does not restart | onboarding redirect; explicit `?edit=1` | Routing E2E |
| Real opportunities only | existing safe feed; no new fixtures in runtime | Phase 16 regression |
| Privacy-safe analytics | closed event/property schemas and deterministic keys | Unit and API tests |
| Owner RLS and forged owner denial | existing policies; queue client revocation | Hosted User A/User B test |
| Desktop Direction A continuity | existing tokens and optimized progress panel | Production screenshots |
| Mobile 390×844 usability | compact progress/action layout | Mobile E2E and screenshots |
| Accessibility | semantic fields, alert focus, native details, keyboard flow | Automated + keyboard E2E |
| No Phase 17 | scope and diff review | Final review |

## Old-to-new coverage

| Old step | Activation handling | Post-onboarding handling |
| --- | --- | --- |
| Your goals | Required in Goals | Editable Passport goals |
| About you | Citizenship/residence in Background | Remaining personal context later |
| Destinations | Required choice in Goals | Editable destination preferences |
| Academic history | Qualification/field/status; grade optional | Institutions, dates, awards, publications |
| Professional history | Occupation/status/experience basis | Employers, responsibilities, achievements |
| Skills | One shared core-skills control | Proficiency, years and evidence |
| Certifications | Compact status only when useful | Full credential records |
| Skilled/trade | Occupation, range, certification and licence state | Evidence, tools, portfolio and detailed licensing |
| Language | Basic optional status | Exact test details and scores |
| Documents | Deferred | Private Documents/Getting Started experience |
| Review | Grouped Review stage | Repeatable Passport review/edit |

## Final gate record

- [x] The forward-only preview contained only `20260908140002_onboarding_optimization.sql`.
- [x] The hosted migration applied and appears in linked migration history as `20260908140002`.
- [x] The second dry run returned `Remote database is up to date` with no pending migrations.
- [x] Linked `public` schema lint returned `No schema errors found`.
- [x] Generated Supabase types exactly match the hosted schema (matching SHA-256 hashes).
- [x] Hosted owner isolation, forged-owner, consent, idempotency, versioning and rematching-queue coverage passed.
- [x] The complete Phase 2–16 hosted integration/security regression run passed: 16 files and 21 tests.
- [x] Unit passed (48 files, 181 tests), component passed (12 files, 49 tests), production E2E passed (140 passed, 115 intentional project/viewport skips), production visual passed (90 passed, 350 intentional project/viewport skips), and the 59-route production build passed.
- [x] The 32-image onboarding evidence set covers desktop and 390×844 mobile states and was directly inspected.
- [x] Keyboard-only completion, focus restoration, 200% zoom-equivalent layout, 44px targets, secret scans, tracked-environment checks, client-bundle scan and health-response review passed.
- [x] Production dependency audit returned zero vulnerabilities.
- [x] Disposable output is excluded; staging, cached-diff validation, credential scanning and delivery postconditions are recorded in the final delivery report.
