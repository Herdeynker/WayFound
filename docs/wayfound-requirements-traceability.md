# WAYFOUND Requirements Traceability Matrix

This matrix prevents scope loss. IDs are stable; implementation may add subrequirements but must not silently remove these.

| ID         | Requirement                                                       | Phase | Required evidence                          |
| ---------- | ----------------------------------------------------------------- | ----: | ------------------------------------------ |
| WF-FND-01  | Strict app foundation, CI, env validation and safe health check   |     0 | Clean CI/build and health tests            |
| WF-FND-02  | Provider abstractions and server-only secrets                     |     0 | Interface tests and bundle/source audit    |
| WF-DSN-01  | Direction A tokens and custom visual language                     |     1 | Visual snapshots/reference comparison      |
| WF-DSN-02  | Exact two handwritten route signatures                            |  1, 8 | Rendered responsive SVG checks             |
| WF-DSN-03  | Deliberate desktop and mobile dashboard compositions              |  1, 8 | Viewport screenshots and interaction tests |
| WF-MOB-01  | Every included workflow fully usable on mobile                    |   All | 360/390/412/430 acceptance per phase       |
| WF-A11Y-01 | WCAG-oriented semantics, focus, contrast and 44px targets         |   All | Automated and manual checks                |
| WF-ID-01   | Email/password, magic link, Google, recovery and protected routes |     2 | Auth integration/E2E tests                 |
| WF-ID-02   | Versioned consent, export and deletion                            | 2, 14 | DB/job/audit tests                         |
| WF-SEC-01  | User-owned data isolated by RLS/storage policy                    |  2–14 | User A/B policy tests                      |
| WF-PAS-01  | Multi-goal conditional Opportunity Passport                       |     3 | Persona E2E tests                          |
| WF-PAS-02  | Autosave/resume/completion/version snapshots                      |     3 | Integration tests                          |
| WF-PAS-03  | CV proposals require confirmation                                 |     3 | UI/unit tests                              |
| WF-OPP-01  | Global multi-type normalized opportunity model                    |     4 | Four representative fixtures               |
| WF-OPP-02  | Original evidence/provenance and opportunity versions             |   4–6 | DB and ingestion tests                     |
| WF-OPP-03  | Global destinations include China and named top locations         |   4–8 | Seeds/adapters/fixtures                    |
| WF-ING-01  | Automated policy-aware, idempotent multi-source ingestion         |     5 | Replay/failure/resume tests                |
| WF-ING-02  | Strict structured AI extraction; invalid output rejected          |     5 | Schema/adversarial tests                   |
| WF-ING-03  | Duplicate merge retains evidence                                  |     5 | Idempotency/version tests                  |
| WF-CNF-01  | Separate explainable source and sponsorship confidence            |     6 | Factor/label tests                         |
| WF-CNF-02  | Vacancy sponsorship distinct from employer register status        |  4, 6 | Counterexample fixtures                    |
| WF-CNF-03  | Freshness/lifecycle and automatic suppression, no admin approval  |  5, 6 | Transition/threshold tests                 |
| WF-RSK-01  | Risk signals embedded in opportunities; public checker deferred   | 6, 20 | Detail UI and scope audit                  |
| WF-MAT-01  | Deterministic hard requirements with pass/fail/unknown/N/A        |     7 | Evaluator unit tests                       |
| WF-MAT-02  | Explainable soft match, gaps, disqualifiers and evidence          |  7, 8 | Persona and detail tests                   |
| WF-MAT-03  | Pathway readiness and explainable Next Best Action                |  7, 8 | Rule and UI tests                          |
| WF-EXP-01  | Personalized feed, search, filters, save and dismiss              |     8 | E2E/query tests                            |
| WF-EXP-02  | Details show sources, checks, confidence, fit and gaps            |     8 | E2E/evidence tests                         |
| WF-DOC-01  | Private validated versioned documents                             |     9 | Storage/security tests                     |
| WF-APP-01  | Opportunity workspace, checklist, deadlines and tracker           |     9 | E2E/state-history tests                    |
| WF-AI-01   | Fact-grounded CV analysis and application drafting                |    10 | Grounding/adversarial tests                |
| WF-AI-02   | Draft versions, quotas, retry and exports                         |    10 | Integration/export tests                   |
| WF-NOT-01  | Email/Telegram linking, preferences and deep links                |    11 | Provider adapter/E2E tests                 |
| WF-NOT-02  | Deduplicated outbox, retry, suppression and quiet hours           |    11 | Event/scheduler tests                      |
| WF-PAY-01  | Configurable products, entitlements and atomic usage              |    12 | Policy/concurrency tests                   |
| WF-PAY-02  | Verified idempotent webhooks and reconciliation                   |    12 | Replay/forgery/order tests                 |
| WF-IEL-01  | Original/licensed diagnostic/read/write/speak foundation          |    13 | Provenance and flow tests                  |
| WF-IEL-02  | Practice feedback explicitly unofficial                           |    13 | Content/UI audit                           |
| WF-OPS-01  | Threat model, rate limits, SSRF/upload/prompt defenses            |    14 | Security audit/tests                       |
| WF-OPS-02  | Backups, recovery, observability and provider runbooks            |    14 | Recovery exercise/runbook                  |
| WF-OPS-03  | Funnel metrics without sensitive payloads                         |    14 | Analytics payload audit                    |
| WF-BETA-01 | Complete profile-to-application paid journey                      |    14 | Full Playwright + manual E2E               |
| WF-SCP-01  | No landing page in Phases 0–14                                    |  0–14 | Route/diff scope audit                     |
| WF-SCP-02  | No automatic final application submission in beta                 |  0–19 | Capability/scope audit                     |
| WF-SCP-03  | No legal advice or guaranteed outcome claims                      |   All | Copy/content audit                         |
| WF-POST-01 | Advanced IELTS only after beta prioritization                     |    15 | Approval and phase gate                    |
| WF-POST-02 | Interview Studio with secure media and no prediction              |    16 | Security/rubric tests                      |
| WF-POST-03 | Sourced, dated credential roadmaps                                |    17 | Evidence/freshness audit                   |
| WF-POST-04 | Abuse-resistant referral/partner ledger                           |    18 | Isolation/idempotency tests                |
| WF-POST-05 | User-controlled form assistance; no final submit/bypass           |    19 | Boundary/adversarial tests                 |
| WF-POST-06 | Rate-limited public fit/sponsor/risk acquisition tools            |    20 | Public security/privacy tests              |

## Coverage audit rule

At the end of each phase, filter this matrix to that phase and attach an implementation file/function, at least one verification method and status (`complete`, `partial`, `blocked`). A requirement marked partial or blocked prevents a phase PASS unless the canonical documents explicitly permit deferral.
