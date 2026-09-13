# Phase 15 Requirements Checklist

| Requirement | Implementation evidence | Verification | Status |
| --- | --- | --- | --- |
| Autonomous supply, no founder upload dependency | Authenticated discovery routes, service/store, direct monitoring | Deterministic end-to-end test and route audit | Complete |
| Provider-neutral Brave integration | `SearchProvider`, `BraveSearchProvider` | Header/response/rate-limit unit tests | Complete |
| Hard free-tier cost control | Env bounds plus atomic daily/monthly RPC | Unit concurrency and hosted RPC tests | Complete |
| No automatic paid overage | Literal-false config and 25/750 schema ceilings | Invalid-config tests and migration constraints | Complete |
| Nine destinations and seven types | 63 deterministic query templates | Catalog/rotation unit test and hosted seed count | Complete |
| Adaptive query rotation without private data | Scored daily planner accepts aggregate signals only | Rotation and query-content tests | Complete |
| Search results remain internal leads | Service-only RLS tables; snippets never evidence | Hosted anonymous/authenticated denial tests | Complete |
| New domains unverified | Domain status defaults and registry-only resolver | Source-resolution tests | Complete |
| Secondary source cannot become primary | Resolver and publication RPC require official source | Unit publication and hosted RPC tests | Complete |
| Safe native retrieval | Phase 5 HTTPS/DNS/IP/redirect/size controls extended for feeds | Existing Phase 5 plus Phase 15 tests | Complete |
| API/RSS/Atom/sitemap/JSON-LD/HTML support | Listing and extraction modules | Recorded deterministic tests | Complete |
| Unknown preservation | Strict schema and incomplete-lead state | Malformed/missing-fact tests | Complete |
| Safe official application URLs | Exact registered host gate in JS and SQL | Unit and hosted publication tests | Complete |
| Deduplication and annual cycles | Deterministic classifier, unique keys, publication lock | Exact/probable/annual/replay tests | Complete |
| Evidence, confidence and versions | Phase 15 publication RPC reuses Phase 4/6 objects | Hosted end-to-end assertions | Complete |
| Publication safety | Existing trigger plus stricter official-source RPC | Unit rejection matrix and hosted visibility test | Complete |
| Matching and notifications | Latest snapshots → Phase 7 persistence → Phase 11 outbox | Deterministic pipeline/hosted regression | Complete |
| Lifecycle rechecks | Recheck table, cadence function and bounded jobs | Cadence/backoff tests | Complete |
| Authenticated bounded scheduling | Cron auth, stages, leases, `SKIP LOCKED`, retries | Unauthorized E2E and hosted RPC denial | Complete |
| Direct source compounding | Registry monitoring metadata and zero-search scheduler | Direct-monitor unit/service assertions | Complete |
| Honest disabled state | Disabled configuration, 503 worker response, operations UI | Unit/E2E/visual tests | Complete |
| Privacy-safe operations | Service-only aggregate view/operations payload | RLS and response audit | Complete |
| Credential isolation | Server-only env/header; no DB/client/log storage | Secret and client-bundle scans | Complete |
| Provider pilot | Boundary fully implemented; live pilot requires a securely supplied Brave key | No live result claimed | Permitted deferred activation |
| Phase 2–14 regression | Full repository quality/security suites | Final gate transcript | Complete |
| Phase 16 excluded | Changed-file/route audit | Scope scan | Complete |

Any pending final-gate row must be changed to Complete before Phase 15 PASS and delivery.
