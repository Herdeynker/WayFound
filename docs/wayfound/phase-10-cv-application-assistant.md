# Phase 10 CV and application assistant

## Scope

Phase 10 adds a private, evidence-grounded preparation workspace at `/prepare/assistant`. It reviews pasted CV text against the selected application and confirmed Opportunity Passport data, and creates reviewable application drafts from facts the user explicitly approves. It does not submit an application or make outcome, eligibility, sponsorship, legal, or immigration claims.

The supported materials are tailored CVs, cover letters, motivation letters, personal statements, essays, study plans, impact statements, and recruiter messages. Users choose the tone and a validated 50–2,000 word limit. Drafts remain attached to an existing private application workspace and can be resumed on desktop or mobile.

## Data and ownership model

The hosted schema is introduced by four forward-only migrations:

- `20260908080000_phase10_cv_application_assistant.sql` creates private analyses, findings, approved fact sets, source facts, drafts, generation requests, immutable revisions, usage ledger entries, exports, indexes, ownership triggers, RPC boundaries, grants, and RLS policies.
- `20260908080001_phase10_owner_chain_hardening.sql` validates every trusted-server ownership chain, including revision/request, export/revision, and usage/request relationships.
- `20260908080002_phase10_account_cleanup_constraints.sql` makes circular immutable-history foreign keys deferred so established account deletion can cascade safely without weakening history during normal use.
- `20260908080003_phase10_trigger_record_safety.sql` repairs the shared ownership trigger with record-safe field access for every table shape.

Every Phase 10 table has RLS enabled. Authenticated clients receive owner-scoped `SELECT` only; writes are performed by authenticated server routes or narrow owner-checked RPCs. Anonymous access, cross-user reads, direct client writes, forged ownership, and cross-user RPC actions are denied. Revisions, source facts, analyses, findings, usage records, and export records are append-oriented and protected against ordinary updates/deletes. Account deletion remains the intentional exception.

Raw CV text is bounded in the request, analysed in server memory, and never stored in Phase 10 tables, audit metadata, usage records, or logs. Persisted analyses contain only a SHA-256 input fingerprint, bounded findings, scores, schema versions, and safe status metadata.

## Grounded generation contract

Generation accepts a strict schema: owned application, UUID idempotency key, supported material kind, bounded title, allowed tone, word limit, and one to forty explicitly approved facts. Passport and opportunity provenance is rechecked against server-owned data; a client cannot relabel an invented value as trusted Passport or opportunity evidence. User evidence is visibly labelled as user-provided.

The provider receives a data envelope that marks every payload field as untrusted and instructs it to use only approved facts. Its strict JSON response requires each paragraph to cite one or more approved fact UUIDs. Server validation rejects malformed output, unapproved references, and word-limit breaches before a revision is persisted. Model version, provider name, schema version, input fingerprint, validation summary, and immutable revision number are retained. Explicit approval is required before PDF or DOCX export.

An atomic database reservation enforces owner checks, a daily limit of ten generation requests, at most three attempts for a failed request, and UUID idempotency. Per-minute route limits protect CV analysis and drafting. Generation finalization is replay-safe: an existing immutable revision is recovered and its draft, request, and usage ledger state is reconciled without calling the provider again.

## Provider boundary

The production adapter supports Gemini through a server-only HTTPS request. It keeps the API key in the `x-goog-api-key` header, applies a 15-second timeout, retries one timeout/429/5xx response, validates JSON against the strict output schema, and returns redacted user-facing failures. When provider configuration is absent, generation is honestly disabled; no fake production success is returned.

Configure only in an ignored server environment file or deployment secret store:

```text
AI_PROVIDER=gemini
AI_API_KEY=<server-only value>
AI_MODEL=<approved model identifier>
```

Do not prefix the API key with `NEXT_PUBLIC_`. Deterministic generation is enabled only for automated test execution. Phase 10 has no scheduled or background job.

## User experience and states

The Direction A workspace provides CV review and Writing Studio tabs, explicit evidence checkboxes, a user-evidence question, source labels, qualified general format guidance, save/resume history, review-before-export, and the established product boundary statement. Existing server-derived facts begin unapproved in production. Synthetic test fixtures begin approved only to make deterministic journeys concise and are guarded by the established test-fixture request boundary.

The canonical evidence covers primary writing, analysis success, empty, loading, error, interrupted, stale, permission-denied, provider-disabled, and approved-export states at 1440×900 and 390×844. Native labelled controls, headings, status/alert semantics, focus indicators, touch-sized actions, wrapping, and no-horizontal-overflow checks preserve accessibility and mobile usability.

## Explicit exclusions

Phase 10 does not introduce Phase 11 alerts, Phase 12 billing or entitlement enforcement, Phase 13 IELTS features, automatic application submission, live crawling/ingestion, matching/scoring changes, a new opportunity feed, or a marketing landing page.

## Verification map

- `tests/unit/assistant.test.ts`: CV parsing, alignment semantics, prompt-injection isolation, trusted provenance, strict grounding, word limits, provider retry/validation, and binary export formats.
- `tests/component/assistant-workspace.test.tsx`: explicit approval, user evidence, drafting, approval/export gating, CV review, and honest disabled/permission states.
- `tests/integration/phase10-assistant.test.ts`: hosted anonymous/User A/User B isolation, direct-write denial, forged ownership, immutable history, owner-only approval, idempotency, atomic quota concurrency, and raw-CV non-persistence.
- `tests/e2e/assistant.spec.ts`: desktop writing journey, 390×844 CV/save-resume journey, state handling, overflow, labelled controls, and keyboard focus.
- `tests/e2e/phase10-visual.spec.ts`: canonical desktop/mobile evidence for all Phase 10 states.

Full Phase 0–10 unit, component, hosted integration/RLS, Playwright, visual, production build, audit, migration, lint, secret, and client-bundle gates are required before delivery.
