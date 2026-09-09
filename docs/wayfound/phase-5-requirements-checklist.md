# Phase 5 requirements checklist

| Requirement | Implementation | Security control | Verification | Status |
| --- | --- | --- | --- | --- |
| Approved-source execution | typed policy and adapter contract | active/allowed/non-fixture/robots/terms validation | ingestion unit tests | Complete locally |
| Bounded HTTP and SSRF protection | `ingestion/security.ts` | HTTPS, allowlist, redirect, host, size and timeout controls | URL security tests | Complete locally |
| Strict extraction | `extractedCandidateSchema` | no implicit missing values; bounded evidence | schema/pipeline tests | Complete locally |
| Evidence and provenance | Phase 4 evidence plus response/candidate records | excerpt and metadata bounds | migration + hosted test pending | Pending remote verification |
| Idempotency and duplicates | content-hash lookup and duplicate-candidate table | no automatic fuzzy merge | pipeline replay test | Complete locally |
| Versioning and lifecycle | Phase 4 triggers plus safe run records | timestamp refresh is no-op | hosted test pending | Pending remote verification |
| Checkpoints, failures and locks | Phase 5 operational tables and lease functions | bounded lease/retry/error summaries | unit test; hosted test pending | Pending remote verification |
| Server-only execution | internal cron boundary | exact cron auth, disabled by default, RLS/revokes | cron/unit test; hosted test pending | Pending remote verification |
| No Phase 6 expansion | no scoring, matching, feed or approval UI | scope audit | source audit | Complete locally |
