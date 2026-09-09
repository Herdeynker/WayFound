# Phase 8 opportunity experience

Phase 8 adds the authenticated, mobile-first Explore feed and safe opportunity detail route. It consumes persisted Phase 7 results; it never recalculates eligibility or fit in the browser.

## Data boundary

`getOpportunityFeed` first reads the current user's RLS-protected match records, then intersects their opportunity IDs with `safe_active_opportunities`. It never queries raw opportunities, source registry, evidence, ingestion or confidence tables from UI code. Results are bounded to 100 candidate match records and paginated in stable order. A safe view omission therefore excludes a match even when a historical evaluation exists.

Search, filter and sort inputs are Zod-validated on the server. Search is bounded to 80 characters; filters accept only known semantics. The UI receives a narrow mapped card model, not database rows. Test-only display records are selected only by the existing Playwright fixture request header and cannot enter hosted safe queries.

## Presentation rules

Fit scores are labelled as fit, never probability. Unknown, limited and manual-confirmation states stay visible. Employer-register capability, visa support and relocation assistance are not described as vacancy sponsorship. "Not stated" remains distinct from "not offered". Readiness describes preparation only and never official document validity.

## Feedback and boundaries

Save, unsave and dismiss use the Phase 7 owner-owned, idempotent feedback table through a validated authenticated route. Optimistic state rolls back on failure. Feedback never changes matching, eligibility or scoring. Phase 8 does not create applications, delivery, payments, crawling, notifications, IELTS, adaptive matching or a marketing page.
