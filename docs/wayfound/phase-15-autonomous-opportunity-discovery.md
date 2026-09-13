# Phase 15 — Zero-Cost Autonomous Opportunity Discovery

Status: implemented production architecture; provider disabled by default
Product-owner decision date: 2026-09-13
Scope boundary: no Phase 16 Interview Studio work

## Operating model

WAYFOUND does not depend on the founder finding or uploading opportunities. An authenticated scheduler rotates controlled public-web queries, records every result as a private lead, resolves the strongest registered official source, retrieves it through the Phase 5 SSRF boundary, extracts only explicit facts, validates and deduplicates them, records evidence and Phase 6 confidence, applies the Phase 4 publication guard, dispatches Phase 7 matching, and enqueues consent-aware Phase 11 notifications. Published opportunities then receive lifecycle rechecks.

Search snippets are hints only. They are stored in `opportunity_discovery_leads`, have no browser grants, and are never written to `opportunity_evidence`.

```text
query generation → Brave search → private lead → source resolution
→ safe retrieval → deterministic extraction → validation → deduplication
→ bounded evidence → confidence → publication → matching → notification → recheck
```

## Zero-cost Brave boundary

`BraveSearchProvider` is behind the provider-neutral `SearchProvider` interface. The API key is read only from server environment configuration and sent only in the `X-Subscription-Token` header to Brave's fixed HTTPS endpoint. It is not passed in URLs, logs, database rows, browser data, screenshots, or source control.

Production defaults are deliberately below the provider's cited free allowance:

- 25 calls per UTC day;
- 750 calls per calendar month;
- at most 20 results per query;
- paid overage permanently disabled;
- lower deployment limits accepted, higher limits rejected;
- one request is atomically reserved before provider access;
- rate/quota failures are not aggressively retried;
- unknown quota state fails closed.

The 750-call operating ceiling leaves a 250-call monthly testing/emergency buffer relative to a 1,000-request allowance. The database function `phase15_consume_search_quota` takes an advisory transaction lock and updates daily and monthly windows together, preventing concurrent workers from bypassing either limit.

## Query coverage and rotation

The deterministic catalog contains 63 combinations: seven opportunity types across China, United Kingdom, Canada, Australia, Germany, Ireland, Netherlands, United States and New Zealand, with Nigeria as the initial origin. Queries include current-year, international-applicant, official/government/university/careers, funding or sponsorship and opening/deadline language.

The daily planner selects at most 25 unique queries across scholarship/fellowship, professional/graduate, skilled/trade, research/internship, underserved-country and reserve capacity. Rotation, source freshness, broad aggregate demand, useful-result rate, duplicate rate, rejection rate and seasonal weighting influence priority. No Passport field, user identifier, contact detail or individual query is sent to Brave.

## Direct source monitoring

Verified registry sources compound coverage without Brave calls. The registry records the approved method (`api`, `rss`, `atom`, `sitemap`, `structured_listing`, `json_ld`, `static_html` or an adapter), cadence, ETag, Last-Modified value, content hash, crawl delay and circuit state. Structured API/feed links become private direct-source leads and pass through the same evidence and publication controls.

The native retrieval priority is API, RSS/Atom, sitemap, JSON-LD, static HTML, deterministic adapter and only then a bounded configured AI extractor. JavaScript-only, authenticated, paywalled, CAPTCHA, blocked or policy-disallowed content stays unresolved. WAYFOUND does not use evasive crawling or paid renderers/proxies.

## Source resolution and trust

New domains start `unverified`. A hostname match alone cannot make a source official. Resolution requires an existing active registry row with approved terms/robots status, explicit allowed domains and an appropriate trust tier. Approved secondary directories can discover leads but cannot supply primary evidence. Sponsor-register membership is never interpreted as vacancy sponsorship.

The publication RPC independently rechecks official status, trust tier, exact approved host, deadline treatment and non-expiration. It therefore cannot be bypassed by a compromised extraction worker.

## Extraction, evidence and unknowns

The native extractor prefers structured JSON-LD and then bounded deterministic HTML. It extracts only explicit supported facts. Missing organization, type, destination/global scope, deadline treatment or safe application URL leaves the lead incomplete. “Funded” is not upgraded to “fully funded”; sponsorship requires vacancy-specific wording; unstated dates and qualifications remain unknown.

Only bounded excerpts from a verified official page become evidence. Full pages, provider headers, credentials, cookies, CV contents and personal data are not persisted in Phase 15 operational records. An optional future AI extractor must retain the existing strict schema, bounded I/O, evidence references, versioning and deterministic post-validation and cannot publish by itself.

## Deduplication, versions and publication

Deduplication uses canonical/final/application URLs, external IDs, content hashes, canonical duplicate keys and normalized organization/title/destination/type/deadline facts. Database uniqueness and an advisory publication lock make replay and concurrent workers idempotent. The same listing refreshes one opportunity and retains evidence. A changed deadline/content creates normal Phase 4 material history. Different annual deadline years are distinguishable cycles.

Publication requires a non-fixture active record, valid type, title, organization, destination/global scope, registered official primary source, safe source/application URLs, current check, explicit deadline treatment, active bounded evidence, Phase 6 confidence and a safe lifecycle. Expired, withdrawn, inaccessible, contradictory, suspicious-payment, secondary-only and incomplete records stay unpublished.

## Matching and notifications

After publication, the worker selects the latest immutable confirmed Passport snapshot per user. Broad pathway and destination filtering dispatches the existing deterministic Phase 7 persistence boundary; unknown requirements remain `more_information_needed`, not eligible. New immutable opportunity versions produce new input fingerprints. Phase 11 notification events use an occurrence key containing that version, preserving consent, preferences, quiet hours and deduplication.

## Scheduling and bounded work

Deployment invokes authenticated GET or POST endpoints under `/api/internal/discovery/[stage]`. The supported stages are query generation, web discovery, known-source monitoring, lead resolution, retrieval, extraction, validation, deduplication, confidence, publication, matching, notification, recheck, retry and cleanup. Each invocation is bounded; database workers use leases, `SKIP LOCKED`, idempotency keys, attempt limits, backoff and dead-letter states. The compatibility endpoint `/api/internal/ingestion` now schedules real known-source work rather than returning a placeholder acceptance.

Suggested launch cadence:

- `query_generation`: daily shortly after 00:00 UTC;
- `web_discovery`: spread through the day, never more than the configured quota;
- `known_source_monitoring`: every 4–8 hours;
- lead-processing stages: every 10–30 minutes with bounded batches;
- scholarship/fellowship rechecks: daily;
- closing-soon rechecks: daily;
- registries: their approved refresh interval;
- retry/cleanup: controlled backoff and daily maintenance.

No job depends on a developer laptop. The hosting scheduler must send `Authorization: Bearer <CRON_SECRET>`.

## Configuration and activation

Required production settings are documented without values in `.env.example`:

```text
OPPORTUNITY_DISCOVERY_ENABLED=false
OPPORTUNITY_SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=
OPPORTUNITY_SEARCH_DAILY_LIMIT=25
OPPORTUNITY_SEARCH_MONTHLY_LIMIT=750
OPPORTUNITY_SEARCH_RESULTS_PER_QUERY=20
OPPORTUNITY_PAID_OVERAGE_ALLOWED=false
```

Activation procedure:

1. Store the Brave key in the deployment secret manager, never Git or Supabase.
2. Configure a strong scheduler secret.
3. Keep `OPPORTUNITY_PAID_OVERAGE_ALLOWED=false`.
4. Start with lower limits and run a maximum-ten-call pilot.
5. Inspect private lead, resolution, retrieval, extraction, confidence, publication and duplicate metrics.
6. Confirm the existing feed and notification behavior with temporary development users, then clean those users.
7. Enable production cadence only after the pilot remains inside the free limit.

Without a key the app builds and runs, operations report `provider_disabled`, web search returns 503, no fake successful run is recorded, and no paid fallback is attempted. Directly monitored existing opportunities and the user experience remain stable.

Emergency shutdown is one reversible setting: set `OPPORTUNITY_DISCOVERY_ENABLED=false`. If needed, remove scheduler invocations and rotate the Brave/cron secrets. Existing published evidence is preserved.

## Adding an adapter

1. Register the exact source and allowed domains with reviewed terms/robots status.
2. Implement the Phase 5 `SourceAdapter` identifier/version or a native structured retrieval method.
3. Keep discovery bounded and extraction strict.
4. Add deterministic recorded fixtures for success, malformed content, unsafe redirect, timeout and replay.
5. Prove secondary content cannot become primary evidence.
6. Run hosted RLS and complete regression gates before enabling the source.

## Operational visibility

The service-only operations summary exposes counts only: daily/monthly use and remaining cap, new/private leads, duplicates, rejections, publications, backlog, unverified domains, retrieval/extraction failures and last end-to-end success. It does not expose raw snippets/evidence, registry notes, credentials, Passport information or contact details.

## Phase 16 exclusions

Phase 15 does not add Interview Studio, recording/media flows, interview predictions, automatic applications, a manual approval queue or the marketing landing page. Advanced IELTS remains future unscheduled scope after the Phase 13 foundation; it is not part of this product-owner Phase 15 decision.
