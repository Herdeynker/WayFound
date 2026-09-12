# WAYFOUND Phase 14 — Paid-beta launch readiness

Status: implemented and verified for the paid-beta checkpoint.

## Scope

Phase 14 turns the verified Phase 13 product into a controlled paid-beta candidate. It adds security and privacy hardening, upload quarantine, persistent abuse controls, privacy-safe funnel events, operational visibility, policy surfaces, and launch evidence. It does not add a landing page, automatic application submission, guaranteed outcomes, Phase 15 listening, pronunciation analysis, adaptive study, or an expanded IELTS bank.

## User journey

Authenticated users can open **Settings → Privacy & consent** to understand the product boundary, private storage, upload scanning, external submission responsibility, verified paid access, consent history, and policy version. The public `/legal` route makes the privacy notice, terms, disclaimer and retention schedule available before registration. Important failure, interrupted, stale, permission and provider-disabled states never claim completion.

The paid-beta journey remains:

1. Register and make versioned consent choices.
2. Complete the multi-goal Opportunity Passport.
3. Review evidence-backed matches and readiness explanations.
4. Save an opportunity and create an application workspace.
5. Use paid assistance only after server-side entitlement verification.
6. Review and export drafts; submit externally under the user’s control.
7. Track application outcomes, alerts and IELTS preparation.
8. Manage billing, privacy, export and deletion from settings.

## Security implementation

- `phase14_consume_rate_limit` provides atomic, shared fixed-window controls. Identifiers are SHA-256 digests; raw IP addresses and user identifiers are not stored in rate-limit rows.
- Production fails closed if the persistent limiter is unavailable. Isolated in-memory behavior exists only for local/test fixtures without server credentials.
- Registered ingestion hosts are checked against the configured domain allowlist and public DNS addresses before every request and redirect. Private, loopback, link-local, carrier-grade NAT, benchmarking, multicast and non-global IPv6 destinations are blocked.
- Structured logs redact sensitive keys and also scrub credentials, contact data and tokens embedded in free-text error messages.
- `/health` exposes only `status` and a timestamp, with no environment, build, dependency, connection or credential detail.
- CSP and response headers prevent framing, MIME sniffing, cross-origin resource use and unnecessary device access. Microphone access is limited to the same origin for the user-initiated Phase 13 recorder.
- Existing server-side authorization, RLS, private storage, expiring signed URLs, provider signature verification, idempotency and entitlement checks remain authoritative.

## Upload quarantine and scanning

Documents and speaking recordings are uploaded to the private `user-document-quarantine` bucket first. The service records an immutable scan timeline, invokes the server-only scanning adapter, and promotes a clean object to `user-documents`. Infected objects are removed; scanner failures fail closed and do not produce a library record or success message.

Production scanning uses the `clamav_http` adapter with an HTTPS endpoint, exact-host allowlist, bearer credential, eight-second timeout, no redirects and a strict `{ "clean": boolean }` response. `UPLOAD_SCANNER_PROVIDER`, `UPLOAD_SCANNER_URL`, `UPLOAD_SCANNER_TOKEN`, and `UPLOAD_SCANNER_ALLOWED_HOST` are server-only. When they are absent, upload attempts return an honest unavailable response. The deterministic clean adapter is limited to tests; the standard EICAR marker is always rejected.

## Privacy-safe analytics

The service records only a closed funnel vocabulary: registration, onboarding completion, first useful match, save, application workspace, submission, outcome, alert open, upgrade, AI export and return session. Events accept only bounded `channel`, `pathway`, `plan`, `status`, `source`, and `surface` string properties. Raw profile fields, contact details, URLs, CV/document contents, payment details and provider payloads are prohibited. Events are immutable and service-written. Default operational retention is 30 days.

## Operational visibility

`GET /api/internal/operations` requires the timing-safe cron bearer boundary and returns bounded aggregate status only: ingestion freshness/failures, notification backlog/failures, unresolved billing provider events, scan backlog/infected count, estimated AI cost units, and funnel volume. It never returns user IDs, provider references, destinations, documents, payments or raw event properties.

## Configuration

Required production configuration remains documented in `.env.example` without values. Phase 14 adds the four scanner variables described above. A configured `CRON_SECRET` is required to read the internal operational summary. Secrets must be supplied by the deployment secret store and must never use a `NEXT_PUBLIC_` prefix.

## Retention and recovery

Operational rate-limit rows expire after their active window and are purged after one day. Funnel events are purged after 30 days by default through the service-only `phase14_purge_expired_operational_data` function. Scan records follow the user account lifecycle; quarantine objects are removed after scan completion/failure and are never user-readable. Product records retain the Phase 2 account-export/deletion and Phase 13 recording-retention controls.

Hosted Supabase point-in-time recovery or scheduled backups must be enabled and monitored according to the project’s paid plan. Recovery drills restore into a separate non-production project and verify migrations, RLS, bucket privacy and record counts before any cutover. The production project must never be reset to perform a drill.

## External limitations

WAYFOUND is decision support, not legal, immigration, recruitment or admissions advice. Matching and AI output can be incomplete and must be reviewed. Opportunity evidence can become stale. Third-party delivery, payment, AI, Telegram and discovery services can be delayed or unavailable. A disabled provider stays visibly disabled; test fixtures never imply production success.

## Verification evidence

The final evidence is recorded in `phase-14-requirements-checklist.md`, the passing hosted Phase 14 integration/RLS suite, the clean remote migration dry run and database lint, and 20 directly inspected production-mode captures under `artifacts/phase-14/`. The complete application matrix also passes unit, component, integration, desktop/mobile Playwright, visual, build and production dependency-audit gates.
