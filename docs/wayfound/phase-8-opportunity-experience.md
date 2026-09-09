# Phase 8 opportunity experience

Phase 8 adds the authenticated, mobile-first Explore feed and safe opportunity detail route. It consumes persisted Phase 7 results; it never recalculates eligibility or fit in the browser.

## Data boundary

`getOpportunityFeed` first reads the current user's RLS-protected match records, then intersects their opportunity IDs with `safe_active_opportunities`. It never queries raw opportunities, source registry, evidence, ingestion or confidence tables from UI code. Results are bounded to 100 candidate match records and paginated in stable order. A safe view omission therefore excludes a match even when a historical evaluation exists.

Search, filter and sort inputs are Zod-validated on the server. Search is bounded to 80 characters; filters accept only known semantics. The UI receives a narrow mapped card model, not database rows. Test-only display records are selected only by the existing Playwright fixture request header and cannot enter hosted safe queries.

## Presentation rules

Fit scores are labelled as fit, never probability. Unknown, limited and manual-confirmation states stay visible. Employer-register capability, visa support and relocation assistance are not described as vacancy sponsorship. "Not stated" remains distinct from "not offered". Readiness describes preparation only and never official document validity.

## Feedback and boundaries

Save, unsave and dismiss use the Phase 7 owner-owned, idempotent feedback table through a validated authenticated route. Optimistic state rolls back on failure. Feedback never changes matching, eligibility or scoring. Phase 8 does not create applications, delivery, payments, crawling, notifications, IELTS, adaptive matching or a marketing page.

## Official application links

The opportunity detail page presents an external application action only after a server-only boundary validates the stored URL. The validator accepts HTTPS only, rejects credentials, unsafe ports, raw IPs, localhost/private-style hostnames, control characters, dangerous schemes and unapproved redirect parameters. The normalized host must match an active, allowed primary-source canonical domain, that source's approved application-provider domains, or the verified organization's official domain on DNS label boundaries. The browser receives only the resulting action, never source-registry or evidence metadata. The application is opened directly with `target="_blank"` and `rel="noopener noreferrer"`; WAYFOUND does not proxy or follow redirects.

Limited, non-allow, stale/conflicting or omitted-safe-view records have no action. Phase 4 safe publication already excludes fixtures, suppressed, expired, withdrawn, inaccessible and superseded records; Phase 6/7 limited decisions also disable the action.

## Verification and evidence

The complete regression suite uses serial hosted-test files so temporary Supabase users and short-lived credentials do not race. Production-mode Phase 8 screenshots are generated through `next start` with `PLAYWRIGHT_TEST=1` and isolated port 3050; this keeps the test fixture boundary while excluding Next development diagnostics. The delivery set contains desktop/mobile feed, search, scholarship and professional detail, employer capability and missing-information warnings, readiness, filters, empty, and permission-denied states. Screenshots are authentic browser captures, not edited images.

Phase 8 remains a discovery experience. It does not introduce Phase 9 applications, reporting, notifications, payments, crawling, ingestion, matching recalculation or a landing page.
