# WAYFOUND Phase 14 paid-beta operations runbook

## Daily checks

Call `GET /api/internal/operations` from the approved operator/scheduler with `Authorization: Bearer <CRON_SECRET>`. Never paste the response into public support channels. Check ingestion freshness and unresolved failures, notification backlog/permanent failures, billing provider backlog, upload scan backlog/infected count, AI estimated cost units and funnel event volume.

Alert thresholds for the initial beta:

- no successful enabled-source ingestion for 24 hours;
- any unresolved policy-blocked or validation failure after operator review;
- notification permanent-failure rate above 5% in 24 hours or a growing pending queue;
- any billing event still pending/retry after two reconciliation windows;
- any scan in pending/scanning for more than 10 minutes, any promotion error, or any infected object;
- AI cost units above the approved daily budget;
- health endpoint non-200 for two consecutive checks.

## Provider handling

Keep a provider disabled until all server-only variables are present and a non-production verification passes. A disabled adapter must return its explicit unavailable state. Do not replace that state with fixture success. Rotate provider credentials immediately after suspected exposure and scan tracked files, build output and logs before re-enabling.

## Upload incident

1. Disable the upload scanner/provider configuration or affected upload route at deployment level.
2. Confirm the object remains in the private quarantine bucket and was not promoted.
3. Review only scan metadata—never copy document contents into logs or tickets.
4. Remove the quarantine object after evidence is recorded according to incident policy.
5. Repair with a forward-only migration/code change and rerun EICAR, bucket-isolation and promotion tests.

## Ingestion / SSRF incident

Disable scheduled ingestion. Inspect the registered source allowlist, resolved public addresses, redirect chain and redacted failure category. Never temporarily permit a private address. Re-enable one bounded source at a time after a clean dry run and fixture validation.

## Billing incident

Do not grant entitlement from a browser callback or support request. Verify the Paystack event and transaction server-side, inspect replay fingerprint and reconciliation result, then use the existing audited adjustment/recovery boundary. Never edit immutable payment history. Disable checkout if price/version checks disagree.

## Backup and recovery drill

Confirm Supabase backup/PITR status in the operator account. At least monthly during beta, restore the latest approved point into a separate recovery project, link a temporary local checkout, apply no destructive command, verify migration history and generated types, run database lint, inspect table counts, run RLS/storage suites and record recovery-point/recovery-time results. Destroy the temporary recovery project only through the approved operator process after evidence retention. Never reset the live project.

## Data requests and retention

Process exports and deletions from their authenticated queues. Verify ownership and request state, use the existing grace period, and record completion without raw data in logs. Run `phase14_purge_expired_operational_data(30)` only as the service role from an authenticated scheduled job. Confirm Phase 13 speaking-recording retention and quarantine cleanup independently.

## Release and rollback

Release only from a clean `main` SHA with recorded remote migrations, clean dry run, database lint, hosted isolation suites, full application gates, inspected production screenshots, audit and bundle scans. Roll back application code by deploying a prior known-good SHA. Database repair is forward-only: never edit an applied migration or reset the hosted database.
