# Phase 11 requirement checklist

| Requirement | Implementation and evidence | Verification | Status |
| --- | --- | --- | --- |
| Secure Telegram linking | Expiring one-time hashed token, verified bot callback, owner unlink and revoked-link handling | Unit, hosted RLS and E2E | Complete |
| Verified email preferences | Auth-email verification gate and dedicated preference centre | Component, route and E2E | Complete |
| Frequencies | Independent instant, daily, weekly, deadline-only and off channel preferences | Schema, unit and component | Complete |
| Quiet hours and timezone | IANA timezone validation and wrap-aware quiet-hour scheduling | Boundary unit tests and E2E | Complete |
| Canonical event types | New/strong match, deadline, missing-document, interview and expired/withdrawn events | Template and database constraints | Complete |
| Durable outbox | Append-oriented event and per-channel delivery records | Hosted integration and retry tests | Complete |
| Deterministic deduplication | Server-derived event key and unique owner/event constraint | Duplicate and out-of-order tests | Complete |
| Delivery retries and suppression | Bounded claims, leases, backoff, terminal suppression and safe failure codes | Unit and hosted concurrency tests | Complete |
| Safe deep links | Closed authenticated route grammar derived from owned resources | Unsafe redirect and authorization tests | Complete |
| Provider boundaries | Typed Resend and Telegram adapters with server-only secrets, timeout and redacted failures | Provider unit tests and bundle scan | Complete |
| Non-blocking jobs | Authenticated bounded notification worker independent of matching and ingestion | Cron route and failure-isolation tests | Complete |
| Consent, unsubscribe and unlink | Channel consent enforcement, easy preference changes, email opt-out and Telegram unlink | Hosted and component tests | Complete |
| Privacy | Generic message bodies by default; no document/profile contents, tokens or secrets in logs | Source, fixture and secret scans | Complete |
| Honest responsive states | Loading, empty, success, error, interrupted, stale, disabled and permission states | Component, desktop/mobile Playwright and visual evidence | Complete |
| Accessibility | Semantic controls/status, keyboard focus, non-colour status and 44px targets | Component/E2E/manual inspection | Complete |
| Phase 12 boundary | No products, prices, payment, entitlement or billing implementation | Source and route audit | Complete |
| Traceability | Architecture, operations, manual configuration and evidence map | Documentation review | Complete |

Implementation and operational configuration are documented in `phase-11-notification-delivery.md`.
