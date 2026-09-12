# WAYFOUND Phase 14 threat model

Reviewed: 12 September 2026. Scope: paid-beta application, server routes, linked development database, storage and configured providers.

| Boundary | Primary threat | Preventive controls | Detection / recovery | Residual decision |
| --- | --- | --- | --- | --- |
| Authentication | credential stuffing, account enumeration, open redirects | Supabase sessions, shared hashed rate limits, generic recovery responses, local-only redirects | auth audit events and aggregate rate-limit counts | accepted for controlled beta with provider MFA roadmap outside this phase |
| RLS and ownership | anonymous access, cross-user read/write, forged `user_id` | RLS on user tables, owner-chain constraints/triggers, revoked grants, server-only functions | hosted anonymous/User A/User B regression suite | no service key in browser |
| Storage | public CV/audio, path forgery, long-lived access | private buckets, owner-prefix policies, service-only quarantine, expiring signed URLs | bucket policy tests and scan backlog summary | users must protect downloaded copies |
| Uploads | malware, polyglots, MIME spoofing, oversized payloads | bounded size, extension/MIME/signature validation, private quarantine, external scan before promotion, fail closed | immutable scan events, infected/backlog counts, quarantine cleanup | scanner signatures may not identify every new threat |
| URL retrieval | SSRF, DNS resolution to private networks, redirect escape, oversized response | source allowlist, HTTPS only, credential/port rejection, public DNS checks per hop, manual redirect validation, timeout/content/size bounds | classified redacted ingestion failures | approved providers remain responsible for their content |
| Prompts and AI | prompt injection, unsupported claims, sensitive logging, runaway cost | approved facts only, grounding checks, bounded schemas, explicit approval, server-only provider, quotas/entitlements, redaction | rejected grounding, usage ledger, aggregate cost | generated text always requires user review |
| Cron and operations | unauthorized job execution, replay, overlapping work | timing-safe bearer boundary, feature enable switches, leases/idempotency, bounded batches | run records, unresolved backlog and failure summary | deployment scheduler security remains an operator duty |
| Notifications | forged Telegram/webhook, unwanted contact, duplicate alerts | signed/secret boundaries, explicit consent, verified email/link, suppression, deduplication, retries | delivery attempts and failure counts | third-party delivery timing is not guaranteed |
| Billing | forged webhook, replay, price mismatch, false entitlement | Paystack signature verification, event fingerprint, server verification, immutable prices/payments, entitlement RPC | reconciliation runs and unresolved provider-event count | disputes/refunds require operator process |
| Analytics | accidental PII or document/payment leakage | closed event vocabulary, property allowlist, size limit, service-only immutable table, 30-day default retention | schema checks and staged/client-bundle scans | only aggregate operational use approved |
| Export/deletion | abuse, cross-user export, premature deletion | authenticated owner request, rate limits, audit history, grace period | queued-request visibility and support runbook | manual beta operations require dual review |
| Observability | credentials or personal data in logs/errors | sensitive-key and free-text scrubbing, correlation IDs, generic client errors, aggregate-only operations endpoint | secret scans and incident review | no raw provider payloads in dashboards |

## Abuse thresholds

Authentication, checkout, payment verification, AI generation/analysis/export, uploads, Passport saves, feedback, application creation/status, IELTS submissions and Telegram linking are bounded. Limits protect the service rather than imply entitlement. A `429` is a real rejection and must not create the protected side effect. Production refuses the action if the shared limiter cannot make an authoritative decision.

## Incident priorities

- **Critical:** leaked server credential, cross-user document/record access, forged paid entitlement, arbitrary SSRF. Disable the affected route/provider, rotate credentials, preserve redacted evidence and begin incident response immediately.
- **High:** malware promotion, repeated webhook bypass, unbounded provider spend, deletion/export ownership error. Quarantine the feature, stop scheduled execution and repair before beta resumes.
- **Medium:** stale operational data, provider outage, individual failed notification or scan. Keep the UI honest, retry within bounded policy and reconcile through the runbook.

No Critical or High finding may remain open at launch sign-off.
