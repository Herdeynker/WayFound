# Phase 13 IELTS foundation

## Scope and boundaries

Phase 13 adds a first-release IELTS preparation foundation for Academic and General Training users. It includes goal setup, original diagnostic and practice material, deterministic timed reading estimates, writing and speaking feedback, private speaking recordings, progress history, weak-area study recommendations and verified links to official resources.

Every score and feedback result is labelled as an unofficial WAYFOUND practice estimate. WAYFOUND is not affiliated with or endorsed by the IELTS test owners. Phase 13 does not add listening, adaptive practice, spaced repetition, copied past papers, official-score claims, crawling, a landing page or any Phase 14 feature.

## Runtime architecture

- `src/features/ielts/` owns strict input/content schemas, deterministic reading calculations, fixture data and the responsive practice workspace.
- `src/app/api/ielts/` authenticates requests, rate-limits mutations, validates untrusted input and delegates privileged writes to server code or narrowly granted database functions.
- `src/server/ielts/` validates audio signatures, fingerprints AI inputs, isolates prompt data and invokes the configured server-only AI provider.
- Existing `AI_PROVIDER`, `AI_API_KEY` and `AI_MODEL` server variables configure estimated feedback. No additional browser variable is required. When the provider is absent, the UI reports that state and never simulates success.
- The existing private `user-documents` storage bucket holds speaking audio. Audio is never placed in browser persistence; only interruption metadata and a user-entered transcript may be retained in session storage.

## Hosted data model

The Phase 13 migration chain creates:

- `ielts_content_items` and `safe_active_ielts_content` for governed, versioned practice content;
- `ielts_official_resources` and `safe_active_ielts_resources` for verified external references;
- `ielts_profiles` for test type, target band, test date and user-selected recording retention;
- `ielts_attempts`, `ielts_attempt_responses`, `ielts_feedback` and `ielts_study_plans` for private, idempotent history;
- `ielts_speaking_recordings` for the owner-bound link between an attempt and a private document version; and
- `phase13_start_attempt`, `phase13_set_attempt_interrupted` and `phase13_submit_reading` for server-validated lifecycle and deterministic scoring.

All user-owned tables have RLS enabled. Anonymous access is denied. Authenticated users can read only their own history and cannot forge owners or directly write service-controlled results. Completed attempts, responses, feedback and study plans are immutable to clients. Account deletion still cascades through Phase 13 records.

The forward-only corrections following the foundation migration preserve least privilege: answer keys remain server-only, the safe security-invoker projection may evaluate publication status, heterogeneous child records are validated safely, delete cascades remain available, and approved audio types use the existing private document model without relaxing the 10 MB limit for non-audio documents.

## Content governance and authoring

Only `original` or explicitly `licensed` content with `licence_status = 'approved'` may become active. Licensed material must include a licence reference. The database activation trigger rejects content that does not meet these rules.

New content must be introduced through a forward-only migration and include:

1. a stable unique slug and explicit Academic/General, skill and activity classification;
2. bounded content that passes the matching Zod task schema;
3. provenance title, author, URL where applicable, provenance type and licence state;
4. a monotonically increasing content version; and
5. an answer key only for deterministic reading content, never in the safe client projection.

Do not copy or scrape official test papers. Official IELTS pages are linked as external resources only. Before activation, add unit coverage for the schema and hosted coverage for the provenance trigger and safe projection.

## Scoring, feedback and idempotency

Reading answers are scored in a security-definer database function against the private answer key. The bounded half-band estimate is deterministic and is explicitly not an official score conversion. The same owner and idempotency key return the existing attempt/result and cannot create duplicate history.

Writing and speaking feedback use a versioned `phase13.feedback.v1` JSON contract. Task text and candidate responses are wrapped as untrusted data. Provider output is schema-validated before persistence. Speaking feedback is based on the transcript and does not claim pronunciation assessment because Phase 13 performs no audio analysis. No AI output silently rewrites profile information.

## Recording privacy and retention

Speaking upload requires current document-storage consent and a saved retention choice. The route accepts only bounded WEBM, WAV, OGG or M4A/MP4 audio whose extension, MIME type and file signature agree. Objects are owner-prefixed in a private bucket. A cross-user download is denied by storage RLS, and a failed multi-step save removes the newly written object and version before returning an honest retry state.

`retention_expires_at` records the user's 7, 30 or 90 day UI choice (the validated database domain supports future values up to 365 days). Operational deletion at expiry remains a scheduled retention concern; the stored deadline is authoritative and no public URL is created.

## Verification and safe extension

Unit tests cover strict validation, scoring boundaries, timer resumption, content governance, prompt isolation and audio signatures. Component and Playwright tests cover first use, Academic/General setup, reading, writing, recording permission denial, provider-disabled behavior, accessibility and responsive layouts. Hosted integration tests cover migration objects, provenance rejection, deterministic replay, anonymous/User A/User B isolation, forged writes, immutability, private storage and account cleanup.

Extend Phase 13 only through new migration files, additive versioned schemas and explicit tests. Never edit an applied migration, expose answer keys or service credentials, make the bucket public, convert an estimate into an official claim, or reuse a response for another purpose without current consent.
