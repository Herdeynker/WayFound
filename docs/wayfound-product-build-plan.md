# WAYFOUND Product Build Plan

Status: Implementation roadmap

This plan covers the logged-in application only. It deliberately excludes the marketing landing page.

## Locked requirements

- Mobile-first responsive PWA; every feature must work fully on mobile.
- Approved Direction A design system and approved desktop/mobile dashboard references.
- Initial users: Nigerians, with architecture that supports other African countries.
- Global opportunities from multiple destinations, including the UK, Canada, Australia, Germany, Ireland, the Netherlands, the United States, New Zealand and China.
- Opportunity types: scholarships, fellowships, graduate programmes, research positions, internships, sponsored professional jobs and sponsored skilled/trade work.
- No manual opportunity-approval queue.
- Automated source-confidence, freshness, duplicate and sponsorship checks.
- No automatic final submission in the first release.
- No immigration legal advice or guaranteed eligibility/sponsorship claims.
- No unauthorized reproduction of protected IELTS material.

## Recommended technical foundation

- Frontend/application: Next.js App Router, TypeScript and Tailwind CSS.
- UI: custom components following the WAYFOUND design source of truth; use an accessible primitive library only for behaviour, not default styling.
- Database, authentication and storage: Supabase.
- Background jobs: Vercel Cron plus idempotent server jobs. Move heavy crawling to a dedicated worker/queue if Vercel duration limits become restrictive.
- AI: provider abstraction supporting structured JSON output. Gemini can be the initial provider because it already exists in the founder's stack.
- Search/discovery: source adapters plus approved search APIs; never rely on one search provider.
- Email: Resend.
- Messaging: Telegram Bot API.
- Payments: provider abstraction; use a provider supporting the required Nigerian and international payment methods.
- Error tracking: Sentry or equivalent.
- Product analytics: privacy-conscious event tracking.
- Testing: Vitest/Jest for units, React Testing Library for components and Playwright for critical journeys.

## Core architecture

The system should be separated into six domains:

1. Identity and Opportunity Passport.
2. Opportunity ingestion and normalization.
3. Verification, confidence and freshness.
4. User matching and recommendation.
5. Preparation: documents, CV, applications, IELTS and interviews.
6. Notifications, payments and operations.

All AI output must pass through schemas and validation before being written to the database or shown as factual eligibility information.

---

# Phase 0 — Repository, decisions and quality gates

## Objective

Create a stable foundation before product features begin.

## Work

- Create the Next.js project or clean application workspace.
- Configure TypeScript strict mode, Tailwind, linting and formatting.
- Create environment validation for all runtime configuration.
- Establish local, preview and production environments.
- Configure Supabase projects and migrations.
- Add automated checks for typecheck, lint, unit tests and build.
- Add error tracking and structured server logging.
- Create feature-flag support.
- Create a provider abstraction for AI, search, payments, email and Telegram.
- Add a `/health` diagnostic endpoint that does not expose secrets.
- Add security headers, rate-limit utilities and server-only secret boundaries.
- Add the approved design source of truth and reference images to project documentation.

## Exit criteria

- A clean deployment succeeds.
- Database migrations run safely.
- CI rejects type, lint, test and build failures.
- Secrets are never shipped to the browser.
- Design references are available to every later implementation phase.

---

# Phase 1 — Design system and responsive application shell

## Objective

Recreate the approved WAYFOUND identity before business features.

## Work

- Implement colour, typography, spacing, radius, shadow and motion tokens.
- Create the vector WAYFOUND route-pin logo variants.
- Create the desktop sidebar and top bar.
- Create the mobile header and fixed bottom navigation.
- Create desktop and mobile route-signature artwork:
  - “Your next step is a bigger story.”
  - “A brighter tomorrow. A wider you.”
- Create the responsive Opportunity Path SVG/artwork.
- Create reusable Button, Input, Select, Dialog, Drawer, Toast, Stepper, Chip, Card, Empty State, Skeleton and Error State components.
- Implement focus, hover, pressed, loading and disabled states.
- Implement safe-area support and reduced-motion support.
- Build a static approved dashboard shell at all target breakpoints.

## Exit criteria

- Desktop and mobile dashboard shells visually match the approved references.
- No generic component-library styling remains.
- Touch targets meet the minimum size.
- Keyboard navigation and focus states work.
- No unintended mobile horizontal overflow exists.

---

# Phase 2 — Authentication, account lifecycle and consent

## Objective

Provide secure user access and explicit consent for personal-data processing.

## Work

- Email/password registration and login.
- Google authentication.
- Magic-link authentication.
- Email verification and password reset.
- Protected application routes and server-side authorization.
- First-login consent covering profile matching, AI processing, alerts and document storage.
- Session management and device sign-out.
- Account settings, data export request and account deletion.
- Audit security-sensitive actions.
- Create user, consent and notification-preference records on registration.

## Exit criteria

- A user can register, verify, log in, log out and recover access on mobile and desktop.
- Unauthorized users cannot access another user's data.
- Consent records are versioned.
- Account deletion removes or anonymizes data according to the retention policy.

---

# Phase 3 — Dynamic onboarding and Opportunity Passport

## Objective

Capture enough structured information for meaningful matching without exhausting users.

## Work

- Goal selection: study/funding, professional sponsorship, skilled/trade work, fellowships/graduate programmes and internships.
- Conditional onboarding paths based on selected goals.
- Progressive sections for personal, academic, professional, trade, language, documentation and preferences.
- Autosave every step.
- Resume-on-next-login behaviour.
- Profile completion calculation.
- Field-level explanations and examples.
- Mobile file capture/upload for CV and basic documents.
- Parse uploaded CV into suggested profile fields; require user confirmation before saving.
- Detect contradictory or incomplete profile information.
- Create profile version history for material matching fields.

## Initial data model

- `profiles`
- `user_goals`
- `education_records`
- `employment_records`
- `skills`
- `user_skills`
- `certifications`
- `trade_experience`
- `language_profiles`
- `country_preferences`
- `document_metadata`
- `profile_versions`

## Exit criteria

- Each pathway collects only relevant questions.
- Onboarding can be completed entirely on a 360 px phone.
- Users can leave and resume without losing answers.
- The Opportunity Passport produces a normalized profile snapshot for matching.

---

# Phase 4 — Opportunity schema, country rules and source registry

## Objective

Create a single normalized model capable of representing every supported opportunity type and destination.

## Work

- Define the opportunity taxonomy and normalized schema.
- Separate common fields from type-specific requirements.
- Create country, destination, occupation, qualification, language, funding, salary and sponsorship models.
- Create structured hard requirements and soft-preference fields.
- Create source registry with trust tier, official-domain rules, crawl policy and refresh frequency.
- Add country-rule modules for initial destinations.
- Add sponsorship evidence types that do not assume all countries operate like the UK.
- Add opportunity lifecycle states: discovered, active, closing soon, expired, withdrawn, inaccessible and superseded.
- Seed country and opportunity taxonomies.

## Core tables

- `opportunities`
- `opportunity_requirements`
- `opportunity_benefits`
- `opportunity_documents`
- `opportunity_sources`
- `source_registry`
- `countries`
- `occupations`
- `qualification_levels`
- `sponsorship_evidence`
- `opportunity_versions`

## Exit criteria

- One schema can accurately represent a China scholarship, German sponsored job, Canadian skilled-work role and Australian fellowship.
- Original source text and normalized facts remain traceable.
- Country-specific sponsorship and funding evidence can be explained to users.

---

# Phase 5 — Automated discovery and ingestion

## Objective

Continuously discover and normalize opportunities without manual approval.

## Work

- Build source-adapter interface.
- Add initial adapters for official government, university, employer, scholarship and sponsor-register sources.
- Add search-based discovery for approved domains and opportunity queries.
- Fetch pages safely with timeouts, retry limits and robots/policy awareness.
- Extract content and canonical URLs.
- Use AI structured extraction for requirements, dates, benefits, salary, funding and application instructions.
- Validate extracted output with strict schemas.
- Calculate content hash and canonical duplicate key.
- Merge duplicate listings while retaining all evidence sources.
- Schedule discovery and refresh jobs.
- Make every job idempotent and resumable.
- Add dead-letter handling for repeated failures.

## Exit criteria

- The pipeline ingests opportunities from multiple countries and types without manual intervention.
- Re-running the same source does not create duplicates.
- Invalid AI output is rejected rather than published.
- Source failures do not stop other sources.

---

# Phase 6 — Automated confidence, freshness and safety

## Objective

Allow automated publishing while clearly representing uncertainty.

## Work

- Confirm official or employer-domain status.
- Recheck page availability and application links.
- Parse and normalize time zones and deadlines.
- Detect expired, withdrawn or substantially changed opportunities.
- Cross-reference sponsor registers where available.
- Differentiate employer eligibility from vacancy-specific sponsorship.
- Detect suspicious payment requests, domain mismatch, redirect anomalies and contradictory dates.
- Calculate source-confidence and sponsorship-confidence scores.
- Store each confidence factor and explanation.
- Automatically limit or suppress results below a defined safety threshold.
- Add user reporting and automated recheck triggers.

## Labels

- Official source
- Employer-site verified
- Confirmed sponsorship
- Probable sponsorship
- Possible sponsorship
- Unverified sponsorship
- Information incomplete
- Closing soon
- Expired

## Exit criteria

- Every opportunity has a source, last-checked time and confidence explanation.
- The system never equates “licensed sponsor” with “this vacancy sponsors”.
- Expired opportunities are removed from active matches automatically.
- No admin approval is required for normal publishing.

---

# Phase 7 — Explainable matching and readiness engine

## Objective

Produce trustworthy user-specific matches instead of generic recommendations.

## Work

- Build deterministic evaluation for hard requirements.
- Build weighted evaluation for soft preferences and competitiveness.
- Treat missing information separately from failed requirements.
- Produce structured match reasons, gaps, disqualifiers and recommended actions.
- Add matching versions so score changes are traceable.
- Calculate pathway-specific readiness scores.
- Generate the Next Best Action from the highest-impact unresolved gap or deadline.
- Recalculate when a profile or opportunity materially changes.
- Add feedback signals for save, dismiss, apply and outcome.
- Create test fixtures for representative Nigerian student, professional and skilled-worker profiles.

## Exit criteria

- The same user receives explainably different scores for different opportunities.
- Hard disqualifiers cannot be hidden by a high semantic similarity score.
- Missing data returns “More information required”, not false eligibility.
- Match explanations cite the relevant published requirement.

---

# Phase 8 — Dashboard, discovery feed and opportunity details

## Objective

Deliver the primary usable product experience.

## Work

- Connect the approved dashboard to real profile, readiness, match, application and IELTS data.
- Implement global search.
- Build personalized opportunity feed.
- Add filters for type, destination, occupation, field, funding, salary, sponsorship confidence, IELTS requirement, deadline and match strength.
- Build saved and dismissed opportunity states.
- Build opportunity-detail pages with requirements, evidence, match explanation, gaps, documents, dates and official links.
- Build mobile swipe carousel and mobile filter drawer.
- Add share and report actions.
- Add loading, no-profile, no-match, error, expired and offline states.

## Exit criteria

- A completed user can see and understand useful matches.
- A user can trace every factual claim to its source.
- Desktop and mobile retain the approved design character.
- Filters and actions work without page-width overflow.

---

# Phase 9 — Document library and application tracker

## Objective

Turn discovery into measurable applications.

## Work

- Secure document upload using private buckets and signed access.
- Validate file type, size and ownership.
- Add document categories, expiry, versions and usage links.
- Create application workspace from an opportunity.
- Generate requirement-specific checklists.
- Add internal deadline and official deadline.
- Add notes, status history and reminders.
- Add statuses: Interested, Preparing, Ready, Submitted, Assessment, Interview, Offer, Accepted, Rejected and Withdrawn.
- Create mobile camera/file-picker upload flow.
- Add interrupted-upload recovery.

## Exit criteria

- Users cannot access another user's documents.
- A user can start, prepare and track an application on mobile.
- Required documents are mapped to the selected opportunity.
- Application status and history are durable and auditable.

---

# Phase 10 — CV intelligence and application assistant

## Objective

Help users produce stronger, truthful application materials.

## Work

- Parse CV structure and compare it with profile data.
- Detect missing, inconsistent and weak sections.
- Calculate role-specific CV alignment.
- Provide country/occupation-specific format guidance.
- Suggest improved bullet points using only supplied facts.
- Generate tailored CV variants.
- Generate cover letters, motivation letters, personal statements, essays, study plans, impact statements and recruiter messages.
- Ask evidence-gathering questions before drafting.
- Add word-limit, tone and factual-consistency checks.
- Store drafts, revisions and source inputs.
- Export clean PDF/DOCX where appropriate.
- Add AI quotas, retry and cost controls.

## Exit criteria

- Generated content does not invent qualifications or achievements.
- The user sees and approves source facts before generation.
- Output is specific to the selected opportunity.
- CV and writing workflows work on mobile, including save and resume.

---

# Phase 11 — Email and Telegram alerts

## Objective

Bring users back when a relevant or urgent event occurs.

## Work

- Telegram account-linking flow.
- Email verification and preference centre.
- Instant, daily, weekly and deadline-only frequencies.
- New-match, strong-match, deadline, missing-document, interview and expired-opportunity templates.
- Deep links into the exact app screen.
- Delivery log, retry and suppression handling.
- Notification deduplication.
- Quiet hours and time-zone awareness.

## Exit criteria

- Users receive no duplicate alerts for the same event.
- Every alert deep-links to an authenticated relevant screen.
- Users can unsubscribe or change frequency easily.
- Failed deliveries do not block matching jobs.

---

# Phase 12 — Payments, entitlements and usage limits

## Objective

Monetize without hard-coding the business model.

## Work

- Define Free, Opportunity/Starter, 90-Day Ready and Pro entitlements as database configuration.
- Integrate chosen payment provider behind an abstraction.
- Implement checkout, verification and webhooks.
- Add subscription/pass activation, renewal, cancellation, expiry and failed-payment handling.
- Meter AI documents, CV analyses, advanced matches and premium alerts.
- Build billing and usage screen.
- Add secure webhook idempotency and reconciliation.
- Add promotion/referral-code foundation without launching a full referral programme yet.

## Exit criteria

- Payment events reliably create the correct access.
- Duplicate webhooks cannot duplicate entitlements.
- Expired access degrades gracefully without deleting user data.
- Product limits are configurable without deploying code.

---

# Phase 13 — IELTS foundation for first release

## Objective

Provide meaningful preparation value without delaying the core opportunity product.

## First-release scope

- Academic versus General Training selection.
- Diagnostic assessment.
- Original reading questions with timed practice and scoring.
- Original writing tasks with structured AI feedback.
- Speaking prompt recorder with transcript and basic AI feedback.
- Target score and test date.
- Progress history and weak-area recommendations.
- Official-resource links.

## Content safeguards

- Store provenance and licence status for every content item.
- Use original or properly licensed content only.
- Label estimated practice bands as unofficial.
- Validate scoring rubrics and avoid promising official equivalence.

## Exit criteria

- Users can complete a diagnostic and receive a study recommendation on mobile.
- Writing and speaking feedback is clearly labelled as estimated practice feedback.
- No protected past paper is reproduced without permission.

---

# Phase 14 — Security, privacy, performance and launch readiness

## Objective

Release a trustworthy paid beta rather than an attractive prototype.

## Work

- Review row-level security for every user-owned table and storage object.
- Threat-model authentication, document access, AI prompt injection, URL fetching and webhooks.
- Add URL allow/block protections against SSRF.
- Add malware/file scanning strategy.
- Add rate limits and abuse controls.
- Redact secrets and sensitive profile data from logs.
- Add backup and recovery procedures.
- Test slow networks, interrupted uploads and background retries.
- Optimize images, fonts, queries and route loading.
- Run accessibility audit.
- Run full responsive visual QA against approved references.
- Add product analytics for onboarding, matches, saves, applications, payment and return usage.
- Prepare privacy policy, terms, disclaimers and data-retention rules inside the app.

## Exit criteria

- Critical security and privacy tests pass.
- Core mobile pages meet performance targets on a mid-range Android device and throttled network.
- Critical Playwright journeys pass on desktop and mobile viewports.
- No placeholder claim, fake metric, testimonial or unsupported eligibility statement remains.

---

# Paid beta release boundary

The paid beta is ready when a user can complete this full journey:

1. Register and consent.
2. Select one or more goals.
3. Complete an Opportunity Passport.
4. Receive explainable global opportunity matches.
5. Open an opportunity and understand requirements, confidence and gaps.
6. Save it and create an application workspace.
7. Upload a CV/document.
8. Generate a truthful tailored application draft.
9. Receive a Telegram or email reminder.
10. Upgrade and receive the correct entitlement.
11. Complete an IELTS diagnostic or practice task if relevant.
12. Return and update the application outcome.

Do not delay beta for full auto-application, a huge IELTS library, native apps or exhaustive country/licensing coverage.

---

# Post-beta phases

## Phase 15 — Advanced IELTS

- Full listening mocks with original audio.
- Larger original question bank.
- Improved pronunciation and fluency analysis.
- Adaptive study plan and spaced practice.

## Phase 16 — Interview studio

- Opportunity-specific job and scholarship interviews.
- Text, audio and optional video practice.
- STAR-answer coaching and progress tracking.

## Phase 17 — Credential and licensing roadmaps

- Structured regulator data by country and occupation.
- Roadmaps for nursing, teaching, engineering, driving, care work and selected trades.
- Change monitoring for official rules.

## Phase 18 — Referral and partner layer

- User referrals and credit rewards.
- Creator and community attribution.
- Partner dashboards and bulk client credits.
- Abuse and self-referral controls.

## Phase 19 — Assisted application filling

- User-controlled browser assistance.
- Reusable answer library.
- Field mapping and review screen.
- User performs the final declaration and submission.

## Phase 20 — Public acquisition tools

- Sponsorship CV Check.
- Scholarship Fit Check.
- Skilled-Work Eligibility Check.
- Sponsor Checker.
- Opportunity risk/scam signals.

---

# Cross-phase engineering rules

- Every migration is versioned and reversible where practical.
- Every background job is idempotent.
- Every external provider is wrapped behind an internal interface.
- Every factual AI extraction stores original evidence.
- Deterministic rules decide hard eligibility; AI assists extraction, interpretation and writing.
- AI must never silently overwrite user data.
- Mobile acceptance is required in the same phase as desktop; mobile is not a later cleanup phase.
- No phase is complete without loading, empty, error and permission-denied states.
- Do not expose service-role keys or provider credentials to the client.
- No opportunity may display as active without a source URL, last-checked time and deadline/open-status treatment.

---

# Recommended execution order

## Build block 1 — Usable product shell

Phases 0–3: foundation, design, authentication and Opportunity Passport.

## Build block 2 — Core value engine

Phases 4–8: data model, automated discovery, confidence, matching and opportunity experience.

## Build block 3 — Conversion to application

Phases 9–11: documents, application tracker, AI preparation and notifications.

## Build block 4 — Monetized beta

Phases 12–14: payments, IELTS foundation, security and launch readiness.

## Build block 5 — Retention and expansion

Phases 15–20 after real usage identifies the highest-value expansion.

---

# Commercial and product success instrumentation

Track from the first beta:

- Registration-to-onboarding completion.
- Time to first useful match.
- Percentage receiving at least three strong or good matches.
- Opportunity save rate.
- Application workspace creation rate.
- Application submission rate.
- Free-to-paid conversion.
- Cost per activated user.
- Seven-day and 30-day return rate.
- Alert open and click-through rate.
- AI draft completion and export rate.
- User-reported interview, offer and scholarship outcomes.
- Match-dismissal reasons.
- Opportunity freshness and extraction-error rate.
- AI, search, notification and storage cost per active paid user.

The product is not succeeding merely because users register. The meaningful activation event is: **a user finds a relevant match and starts a real application.**

---

# Final completion definition

WAYFOUND's first release is complete only when it is:

- Functionally useful from profile to real application.
- Fully mobile-friendly across every included feature.
- Automatically supplied with multi-country opportunities.
- Explainable and honest about confidence and eligibility.
- Visually faithful to the approved Direction A references.
- Secure enough for personal profiles and documents.
- Monetized with correctly enforced entitlements.
- Observable enough to diagnose pipeline and delivery failures.
- Measurable against real user activation, applications and paid conversion.
