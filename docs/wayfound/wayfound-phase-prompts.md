# WAYFOUND Paste-Ready Implementation Prompts

## Instructions

Paste exactly one phase prompt into Codex at a time. The repository must contain the canonical WAYFOUND documents and approved images. Replace bracketed values only when the prompt explicitly asks for a real credential/provider decision. Never put secrets into prompts or committed files.

## Common contract for every phase

The following contract is incorporated into every prompt below:

> Work only on the named phase. First inspect the repository, current branch/status, applicable AGENTS.md files, package scripts, migrations and the canonical files under `/docs/wayfound/`. Preserve existing user changes. Read `wayfound-implementation-package.md`, `wayfound-technical-prd.md`, `wayfound-requirements-traceability.md`, `wayfound-approved-design-source-of-truth.md` and `wayfound-product-build-plan.md`. Identify conflicts before editing. Implement production-quality code rather than disconnected mockups. Use versioned migrations, strict types, server-side authorization, RLS, accessible custom UI and provider interfaces. Do not introduce the marketing landing page. Mobile completion is part of the phase, not deferred. Add tests and all loading/empty/error/permission states relevant to the phase. Run the repository's format/check, lint, typecheck, unit/integration tests and production build; run relevant Playwright tests at mobile and desktop viewports. Fix in-scope failures. Do not claim a command passed unless you ran it and saw success. End with: scope completed; requirements covered; files changed; migrations; tests and exact results; responsive/accessibility checks; security/privacy checks; assumptions; remaining risks; manual acceptance steps. If blocked, state the exact blocker and leave the repository in a safe state.

---

## Phase 0 — Foundation

```text
Implement WAYFOUND Phase 0: repository, decisions and quality gates. Apply the Common Contract.

Create or normalize a Next.js App Router + TypeScript strict + Tailwind workspace. Configure formatting/linting, environment validation, Supabase local/config/migration structure, CI gates for lint/typecheck/test/build, unit and Playwright foundations, structured server logging, error tracking boundary, feature flags and provider interfaces for AI, discovery/search, payments, email and Telegram. Add server-only secret boundaries, baseline security headers, rate-limit primitives and a non-sensitive /health endpoint. Add .env.example with names only. Copy/reference the approved product/design documents and three reference images under /docs/wayfound without building the landing page.

Write architecture decisions for runtime boundaries, provider adapters, migrations and job idempotency. Provide fake/local adapters where credentials are absent; never invent credentials. Establish preview-safe seed/fixture conventions. Verify no secret is included in a client bundle. Exit only when clean install, migrations, tests and production build succeed and CI is configured to reject failures.
```

## Phase 1 — Design system and app shell

```text
Implement WAYFOUND Phase 1: approved Direction A design system and responsive authenticated shell. Apply the Common Contract and inspect the approved desktop/mobile images directly before styling.

Implement exact color/type/spacing/motion tokens, vector logo variants, desktop sidebar/top bar, mobile header/fixed bottom navigation, responsive page container and accessible primitives. Recreate the two mandatory handwritten route signatures as responsive SVG/custom artwork with exact text: “Your next step is a bigger story.” and “A brighter tomorrow. A wider you.” Implement desktop and mobile Opportunity Path artwork/components, including mobile checkpoints and amber endpoint; use a documented CSS fallback if final editorial artwork is not yet available. Build the static dashboard shell matching composition and density, but isolate fixture data behind typed view models for Phase 8 replacement.

Add Storybook or an internal component showcase if the repository supports it. Cover focus, hover, pressed, disabled, loading, skeleton, empty and error treatments. Test 360/390/412/430 px, tablet, 1024, 1280 and 1680 widths, safe areas, keyboard flow and reduced motion. No generic shadcn appearance, crowded grid, accidental overflow or missing route artwork is acceptable.
```

## Phase 2 — Authentication and consent

```text
Implement WAYFOUND Phase 2: authentication, authorization, account lifecycle and consent. Apply the Common Contract.

Use Supabase Auth for email/password, verified magic link, Google adapter/configuration, email verification, recovery, logout and protected app routes. Create profile bootstrap, versioned consent, notification preference and audit-event records transactionally/idempotently. Implement server authorization helpers, safe redirects and session/device sign-out. Add mobile-first login/register/recovery/consent/settings screens within Direction A.

Implement account data-export request and deletion workflow with explicit confirmation, retryable server job and retention/anonymization hooks; document unresolved legal retention durations as configuration. Add RLS tests proving user A cannot read/change user B data and unauthenticated access is denied. Test invalid/expired links, unverified accounts, revoked sessions and OAuth cancellation. Do not log tokens or sensitive fields.
```

## Phase 3 — Opportunity Passport

```text
Implement WAYFOUND Phase 3: conditional onboarding and Opportunity Passport. Apply the Common Contract.

Create normalized schema, migrations, generated types and RLS for goals, education, employment, skills, certifications, trade experience, language profiles, destination preferences, document metadata and profile versions. Build multi-goal onboarding for study/funding, professional sponsorship, skilled/trade work, fellowship/graduate and internship routes. Show only relevant questions, allow backtracking, autosave safely, resume after login and calculate transparent completion by pathway.

Add mobile file/camera entry for CV/basic documents using private storage metadata. Put CV parsing behind the AI adapter and strict schema; proposed values require field-by-field user confirmation and never silently overwrite data. Detect missing and contradictory answers. Create immutable profile snapshots for material matching changes. Test each persona/path, partial resumes, offline/interrupted autosave, upload rejection and cross-user isolation. Ensure the full flow is practical at 360 px.
```

## Phase 4 — Opportunity and source model

```text
Implement WAYFOUND Phase 4: normalized opportunity schema, country rules and source registry. Apply the Common Contract.

Model common facts plus type-specific requirements for scholarships, fellowships, graduate programmes, research, internships, sponsored professional jobs and sponsored skilled/trade work. Add countries, occupations, qualification levels, funding/salary, benefits, required documents, structured requirement operators, source evidence, sponsorship evidence, source registry, lifecycle states and opportunity versions. Preserve original text and provenance for every normalized factual field.

Seed representative rules/taxonomies and fixtures for China, UK, Canada, Australia, Germany, Ireland, Netherlands, US and New Zealand without claiming exhaustive coverage. Sponsor evidence must support country-specific models and separate employer sponsor eligibility from vacancy-specific sponsorship. Add validation and tests proving the schema represents a China scholarship, German job, Canadian skilled-work role and Australian fellowship. System writes remain server-only; user reads expose only safe active records/views.
```

## Phase 5 — Automated ingestion

```text
Implement WAYFOUND Phase 5: automated discovery and ingestion. Apply the Common Contract.

Create a source-adapter contract and initial adapters/fixtures for configured official government, university, employer, scholarship and sponsor-register sources. Add policy-aware search discovery, safe fetch with timeouts/size/redirect limits, canonical URL/content extraction, strict structured AI extraction, schema rejection, captured evidence and extraction version. Add content hashes, canonical duplicate keys, merge behavior preserving sources, lifecycle-aware refresh, idempotent/resumable scheduled jobs, bounded retries and dead-letter records.

Do not add manual approval. Do not publish invalid extraction output. Put cron endpoints behind authenticated server-only invocation and prevent overlapping runs. Use recorded fixtures in tests rather than fragile live-network tests. Demonstrate: repeated ingestion creates no duplicate; one failed source does not stop others; changed content creates a traceable version; invalid AI output is quarantined; a run can resume safely.
```

## Phase 6 — Confidence, freshness and safety

```text
Implement WAYFOUND Phase 6: automated source confidence, sponsorship confidence, freshness and risk signals. Apply the Common Contract.

Implement explainable factor-based checks for official/employer domain, page/application-link availability, normalized deadline/timezone, material changes, sponsor-register cross-reference, vacancy-specific sponsorship evidence, suspicious payment wording, domain/redirect mismatch and contradictory dates. Store scores, factors, evidence and check timestamps. Apply configurable publish/suppress thresholds automatically; no admin approval queue.

Expose honest labels including Official source, Employer-site verified, Confirmed/Probable/Possible/Unverified sponsorship, Information incomplete, Closing soon and Expired. Never infer vacancy sponsorship solely from employer registration. Add reporting that records a report and schedules a deduplicated recheck. Test boundary scores, expired/withdrawn transitions, unavailable pages, country variation and adversarial evidence. Embed the checker in opportunity records/details; do not build the Phase 20 public checker.
```

## Phase 7 — Matching and readiness

```text
Implement WAYFOUND Phase 7: explainable matching, readiness and Next Best Action. Apply the Common Contract.

Create a versioned deterministic evaluator for hard requirements with pass/fail/unknown/not-applicable. Add separately weighted soft fit and competitiveness; missing profile data must not count as failure or eligibility. Persist match score/confidence, factors, cited evidence, disqualifiers, gaps and recommended actions. Create pathway-specific readiness snapshots and select Next Best Action using documented impact, urgency and feasibility rules. Recompute idempotently after material opportunity/profile versions.

AI may explain structured results but may not decide hard eligibility. Add save/dismiss/apply/outcome feedback events without covertly changing eligibility. Build comprehensive fixtures for Nigerian student, professional and skilled-worker profiles, including edge/unknown cases. Tests must prove hard disqualifiers cannot be obscured by high semantic similarity and explanations cite the exact normalized requirement/evidence.
```

## Phase 8 — Dashboard and opportunity experience

```text
Implement WAYFOUND Phase 8: live dashboard, personalized feed, search, filters and opportunity details. Apply the Common Contract and visually compare with both approved dashboard images.

Replace Phase 1 fixtures with real typed data for greeting, readiness, Next Best Action, applications, IELTS state and Top Matches. Implement personalized paginated feed, debounced global search, saved/dismissed states and filters for type, destination, occupation/field, funding/salary, sponsorship confidence, IELTS, deadline and match strength. Implement detail pages with requirements, benefits, required documents, dates, source/last checked/official link, confidence explanations, user match reasons/gaps/disqualifiers and share/report.

Preserve exact desktop composition, both handwritten route elements, restrained density, mobile route card, swipe/snap match carousel and mobile filter drawer. Add no-profile, no-match, expired, withdrawn, stale, offline, loading and error states. Prevent stale cached records from appearing active. Test query/filter combinations, pagination, save/dismiss idempotency, evidence links and responsive visual snapshots.
```

## Phase 9 — Documents and applications

```text
Implement WAYFOUND Phase 9: private document library and application tracker. Apply the Common Contract.

Create private storage policies and tables for user documents, versions, expiry/category metadata and usage links. Validate extension, MIME signature, size and ownership; use short-lived signed access. Add application workspace creation from a match, requirement-specific checklist, internal/official deadlines, notes, reminders and statuses Interested, Preparing, Ready, Submitted, Assessment, Interview, Offer, Accepted, Rejected, Withdrawn. Record immutable status history and durable audit events.

Implement mobile camera/file picker, progress, cancellation and interrupted-upload recovery. Do not expose documents in analytics/logs. Test cross-user storage denial, malformed/oversized file rejection, signed URL expiry, repeated workspace creation, checklist mapping, status transition/history and 360 px usability.
```

## Phase 10 — CV and application assistant

```text
Implement WAYFOUND Phase 10: CV intelligence and evidence-grounded application assistant. Apply the Common Contract.

Parse CV structure, compare with confirmed Passport data, find inconsistency/missing/weak sections and score role alignment. Provide country/occupation format guidance with sources/qualification labels where factual. Before generation, collect and display approved source facts. Support tailored CV variants, cover/motivation letters, personal statements, essays, study plans, impact statements and recruiter messages as applicable. Enforce word limits, tone, opportunity specificity and factual consistency.

Store drafts, revisions, source facts, model/schema version and user approval. Implement DOCX/PDF export where appropriate, mobile save/resume, quotas, retries and cost ledger. Reject or flag generated claims absent from approved facts; never invent achievements. Test prompt injection in opportunity/CV text, provider timeout, malformed output, quota race, factual-grounding failures and export correctness.
```

## Phase 11 — Alerts

```text
Implement WAYFOUND Phase 11: email and Telegram alerts. Apply the Common Contract.

Create a secure expiring one-time Telegram-linking flow, verified email preference center, instant/daily/weekly/deadline-only frequencies, timezone and quiet hours. Support strong/new match, deadline, missing document, interview and expired/withdrawn events. Use an event/outbox design with deterministic deduplication keys, retries, suppression and provider delivery logs. Deep-link to the authenticated relevant screen while preventing open redirects.

Notifications must not block matching/ingestion. Avoid sensitive data in message bodies by default. Implement unlink, unsubscribe and provider failure handling. Test duplicate events, retry, quiet-hour scheduling, invalid link token, revoked Telegram link, email suppression and deep-link authorization.
```

## Phase 12 — Payments and entitlements

```text
Implement WAYFOUND Phase 12: configurable payments, entitlements and usage limits. Apply the Common Contract.

Create database-configured products/prices/features for Free, Starter/Opportunity, 90-Day Ready and Pro as editable placeholders, not final commercial claims. Implement a payment provider interface and wire only the founder-approved configured provider. Add secure checkout initialization, server verification, signature-verified webhooks, raw event storage, idempotent processing, payment/customer mapping, entitlement periods, usage ledger, renewal/cancellation/expiry/refund/failure and reconciliation job.

Enforce entitlements server-side and present graceful upgrade/downgrade UI. Expiry never deletes user data. Add billing/usage screens and promo/referral-code foundation without partner payouts. Test duplicated/out-of-order/replayed/forged webhooks, concurrent quota use, failed payment, cancellation, refund and reconciliation. Never store card details or trust a client-supplied payment success.
```

## Phase 13 — IELTS foundation

```text
Implement WAYFOUND Phase 13: original/licensed IELTS preparation foundation. Apply the Common Contract.

Create content/provenance/licence schema and authoring seed format. Implement Academic vs General selection, target/test date, diagnostic, original timed reading tasks and deterministic scoring, original writing tasks with rubric-based estimated AI feedback, speaking recording/upload/transcript with basic estimated feedback, progress history, weak-area recommendations, study plan and official-resource links.

Every item requires provenance and licence status; reject unapproved content from active practice. Label all bands/feedback as unofficial estimates and never imply affiliation with IELTS owners. Secure recordings as user documents with retention controls. Test timers/resume, scoring, malformed AI feedback, recording permission denial, weak network/upload recovery, accessibility and mobile completion. Do not scrape or reproduce past papers.
```

## Phase 14 — Paid beta launch readiness

```text
Implement WAYFOUND Phase 14: security, privacy, performance, observability and paid-beta launch gate. Apply the Common Contract.

Perform and document a threat model for auth, RLS/storage, AI prompt injection, URL fetching/SSRF, uploads, cron, alerts, payments and exports/deletion. Audit every table/bucket policy with cross-user tests. Implement missing rate/abuse controls, secret/sensitive-data redaction, URL protections, backup/recovery runbook and practical malware-scanning/quarantine strategy. Complete privacy/terms/disclaimer/retention UI using approved text or clearly flagged prelaunch placeholders that block production release.

Optimize images/fonts/queries/bundles, test throttled mobile network and interrupted operations, run accessibility and responsive visual audits against references, and validate analytics without sensitive payloads. Build Playwright coverage of the entire beta journey and an operational dashboard/runbook for ingestion freshness, extraction errors, notification delivery, payment reconciliation and provider cost. Remove fake metrics, testimonials, unsupported eligibility and unsafe fixtures from production. Produce a signed-off launch checklist; do not declare launch-ready while any critical/high issue or legal-text placeholder remains.
```

## Phase 15 — Advanced IELTS (post-beta)

```text
Implement WAYFOUND Phase 15 only after paid-beta evidence prioritizes it: advanced IELTS. Apply the Common Contract. Add original/licensed listening mocks with original audio, expanded governed question bank, adaptive/spaced study plan and improved fluency/pronunciation feedback. Preserve provenance and unofficial-estimate labels. Add content QA, accessibility transcripts and mobile audio resilience. Do not import copyrighted past papers.
```

## Phase 16 — Interview Studio (post-beta)

```text
Implement WAYFOUND Phase 16 only after prioritization: Interview Studio. Apply the Common Contract. Add opportunity-specific scholarship/job practice in text/audio and optional video, evidence-grounded question sets, STAR coaching, consent/retention for recordings, structured rubric feedback and progress. Never claim hiring prediction. Ensure low-bandwidth mobile fallbacks and secure media access.
```

## Phase 17 — Credential roadmaps (post-beta)

```text
Implement WAYFOUND Phase 17 only for approved occupations/countries: credential and licensing roadmaps. Apply the Common Contract. Create regulator/source/version/change-monitoring data, dated evidence and step/cost/time prerequisites for selected nursing, teaching, engineering, driving, care and trade paths. Every rule must be traceable and labelled by freshness/jurisdiction; do not provide legal guarantees. Suppress stale/unverified roadmaps automatically.
```

## Phase 18 — Referral and partners (post-beta)

```text
Implement WAYFOUND Phase 18 after commercial rules are approved: referrals and partners. Apply the Common Contract. Add attribution, referral links/codes, configurable credits, creator/community partner views, bulk credits, ledger and payout/export foundation. Add self-referral, duplicate-identity and abuse controls. Do not invent reward rates, tax treatment or payout commitments.
```

## Phase 19 — Assisted form filling (post-beta)

```text
Implement WAYFOUND Phase 19 only after security/legal review: user-controlled assisted form filling. Apply the Common Contract. Add reusable approved answer library, explicit site/field mapping, preview/diff, per-field confirmation and audit history. Treat third-party pages as untrusted. Respect site terms and automation restrictions. Never bypass access controls, CAPTCHAs or anti-bot systems; never perform final declarations or submission. The user remains in control.
```

## Phase 20 — Public acquisition tools (post-beta)

```text
Implement WAYFOUND Phase 20 only after the logged-in product proves value: public acquisition tools. Apply the Common Contract, except this phase may introduce scoped public routes rather than a full marketing landing page. Build selected Sponsorship CV Check, Scholarship Fit Check, Skilled-Work Eligibility Check, Sponsor Checker and Opportunity Risk signals using the same evidence/confidence engines. Rate-limit and minimize data collection, give qualified uncertainty/disclaimers and route useful results into account creation. Do not expose private records or present automated results as guarantees.
```
