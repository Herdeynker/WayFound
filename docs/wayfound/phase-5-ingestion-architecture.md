# Phase 5 opportunity ingestion architecture

Phase 5 is a server-only supply pipeline. It accepts output only from registered, policy-approved adapters, validates it as untrusted data, and writes through the Phase 4 opportunity and publication safeguards. It does not expose an opportunity feed, matching, scoring, recommendations, or a manual approval workflow.

## Source onboarding and adapters

An administrator first creates a `source_registry` entry with a reviewed source type, canonical domain, exact adapter identifier/version, domains, request limits, robots and terms status. A source is executable only when active, allowed, non-fixture, terms-approved and robots-allowed. The typed `SourceAdapter` contract separates listing discovery, cursor progression and detail extraction from persistence. Adapter output is parsed by strict Zod schemas; a new adapter cannot write arbitrary records.

## Fetching and extraction boundary

The outbound fetcher accepts HTTPS URLs only, rejects credentials, ports, localhost, link-local/private IPv4, IPv6 literals and hosts outside the source allowlist. Every redirect is revalidated, with bounded redirect count, timeout, response size and HTML/JSON content type. It uses a declared user agent and never bypasses authentication, CAPTCHAs, paywalls or anti-bot controls.

Extractors retain only bounded evidence excerpts and metadata—not full pages or headers. Missing values are not invented: structured data requires explicit known values, `not_stated`, a rolling deadline, or rejection. The optional future AI boundary may propose schema-validated candidates with evidence and provider metadata, but cannot be primary evidence and is not enabled by Phase 5.

## Persistence, duplicates and lifecycle

Candidates use source/external ID, canonical URL, content hash and Phase 4 canonical duplicate keys. An unchanged content hash is a no-op, so it creates neither a duplicate nor a material version. Probable matches are held in `opportunity_duplicate_candidates`; they are not destructively fuzzy-merged. New evidence is retained as a separate provenance relationship. Phase 4 triggers continue to append immutable material versions when a meaningful record or related fact changes.

Lifecycle refresh preserves expired, inaccessible, withdrawn and superseded records. A transient error is retryable with bounded exponential backoff and jitter; permanent errors, malformed content and policy blocks are recorded safely. A single transient failure never asserts withdrawal.

## Runs, locks, checkpoints and scheduling

`ingestion_runs`, `ingestion_source_runs`, `ingestion_checkpoints`, `ingestion_leases`, `ingestion_failures`, `ingestion_responses` and `ingestion_candidates` hold operational state. Every source has a bounded lease; the database function permits renewal by its owner or acquisition after expiry. Checkpoints are JSON objects and are saved only after a batch completes, making resume deterministic. Errors retain a bounded, redacted summary and classification—not raw pages, credentials, headers or query-string secrets.

`POST /api/internal/ingestion` is an authenticated cron boundary using `CRON_SECRET`. It has no user-controlled URL input and is disabled unless `INGESTION_CRON_ENABLED=true`. No production schedule is configured by this repository. Before enabling it, configure a trusted scheduler, create reviewed source entries and deploy a server-side adapter runner with the required server credentials.

## Security and RLS

All Phase 5 operational tables have RLS enabled and all privileges revoked from `anon` and `authenticated`. Ordinary users cannot start ingestion, edit source policy, read run errors, edit checkpoints, or manipulate evidence/lifecycle/version records. Source configuration and all privileged Supabase access remain server-only. Environment names are documented in `.env.example` without values.

## Test strategy and Phase 6 boundary

Deterministic fixtures exercise scholarship, professional, skilled/trade and fellowship representations without contacting third parties. Unit tests cover source eligibility, SSRF protections, bounded work, validation, idempotency, lease release, retry classification and redaction. Hosted tests must cover database constraints, leases, RLS, evidence, publication safety and Phase 2–4 regressions before release.

Phase 6 is responsible for source/sponsorship confidence and risk scoring. Phase 5 does not infer sponsorship from employer-register membership, score opportunities, publish a public feed, or decide user eligibility.
