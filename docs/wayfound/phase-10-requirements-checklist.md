# Phase 10 requirement checklist

| Requirement | Implementation and evidence | Verification | Status |
| --- | --- | --- | --- |
| CV structure parsing and confirmed-Passport comparison | Bounded server-only parser and `runCvAnalysis`; only fingerprints/findings persist | Unit, hosted integration and UI tests | Complete |
| Missing, inconsistent and weak section detection | Typed bounded findings for structural omissions, Passport differences, weak bullets and alignment | Unit and component tests | Complete |
| Role-specific CV alignment | Selected-opportunity term comparison visibly labelled “not an outcome probability” | Unit and E2E tests | Complete |
| Qualified country/occupation guidance | Visible “General practice” qualification and direction to verify factual rules on the official source | Component, E2E and screenshot review | Complete |
| Approved facts before drafting | Server-derived candidates start unchecked; user-added evidence is explicit; immutable approved fact sets persist | Hosted RLS, component and E2E tests | Complete |
| Evidence-grounded document generation | Strict paragraph-to-fact UUID contract, server provenance validation and unsupported-claim rejection | Adversarial, malformed-output and grounding tests | Complete |
| Supported application materials | Eight canonical material kinds in a closed domain type and labelled selector | Schema, component and E2E tests | Complete |
| Word limit, tone and opportunity specificity | Strict request validation, selected owned application context and post-generation word-count enforcement | Unit, integration and E2E tests | Complete |
| Drafts, immutable revisions and approval | Owner-scoped drafts; provider/model/schema/fingerprint metadata; immutable revisions; owner RPC approval | Hosted immutability/RLS tests | Complete |
| Mobile save and resume | Direction A Prepare workflow, recent-draft history and 390×844 overflow regression | Playwright and production screenshots | Complete |
| DOCX/PDF export | Authenticated owner route exports only an explicitly approved revision and records its checksum | Binary-format and authorization tests | Complete |
| Quotas, retry, idempotency and cost ledger | Atomic owner RPC, daily quota, three-attempt cap, replay recovery and append-only usage ledger | Unit, concurrency and hosted tests | Complete |
| Provider safety | Server-only Gemini adapter, strict schema, header credential, 15s timeout, one bounded retry and honest disabled state | Provider tests, environment and bundle scan | Complete |
| Privacy and ownership | Nine RLS tables, select-own only, server writes, ownership triggers, no raw CV persistence or logging | Anonymous/User A/User B/forged-owner tests | Complete |
| Honest states and accessibility | Loading, success, empty, error, interrupted, stale, permission, disabled and approved states; labelled/focusable controls | Component, E2E, accessibility and visual tests | Complete |
| Scope boundary | No alerts, billing/entitlements, IELTS, automatic submission, Phase 11 work or landing page | Source and route audit | Complete |

Implementation details and operational configuration are documented in `phase-10-cv-application-assistant.md`.
