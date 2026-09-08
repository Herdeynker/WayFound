# WAYFOUND Technical Product Requirements Document

Version: 1.0
Release target: Paid beta
Scope: Authenticated application only

## 1. Product definition

WAYFOUND helps an African opportunity seeker discover credible global pathways that fit their actual profile and move from discovery to a stronger application. It combines verified-source opportunity discovery, explainable matching, readiness guidance, document/application preparation, alerts and IELTS preparation.

It is not a visa agent, immigration law service, recruiter, university representative or guarantee of sponsorship, admission or relocation.

## 2. Target users and jobs to be done

### Student/funding seeker

Find scholarships, fellowships, graduate programmes, research opportunities and internships; understand requirements, funding, deadlines, profile gaps and application materials.

### Sponsored professional

Find vacancy-specific evidence of sponsorship where possible; understand qualifications, experience, language, occupation and country gaps; tailor truthful application materials.

### Skilled/trade worker

Find sponsored skilled-work paths and roles; understand licensing, certification, experience and language requirements without falsely treating an employer's sponsor status as proof that a vacancy sponsors.

Users may select multiple pathways. Onboarding, readiness and recommendations adapt by pathway.

## 3. Product principles

- Fit over volume: fewer well-explained matches beat a generic job board.
- Evidence over assertion: factual claims link to captured source evidence.
- Hard rules before AI similarity: deterministic disqualifiers cannot be overridden by semantic relevance.
- Unknown is not eligible: missing data must be shown as unknown or requiring information.
- Action over browsing: every match should lead to a next step, checklist or application workspace.
- Mobile is primary: the complete journey works on affordable Android devices and weak networks.
- Human control: AI suggestions and drafts require review; AI never silently changes profiles or submits declarations.

## 4. Functional requirements

### Identity, consent and accounts

- Email/password, magic-link and Google authentication.
- Verification, recovery, session/device management and protected routes.
- Versioned consent for matching, AI processing, stored documents and notifications.
- User-accessible notification preferences, data export request and deletion.
- Audited security-sensitive actions.

### Opportunity Passport

- Multi-goal selection and conditional onboarding.
- Personal/origin data, destination preferences, education, employment, skills, certifications, trade experience, language level/test status and relevant documentation.
- Autosave, resume, completion score and profile-version snapshots.
- CV parsing only proposes fields; the user confirms changes.
- Contradiction/missing-field detection with understandable prompts.
- Sensitive attributes not needed for matching must not be collected.

### Opportunity supply

- Registry-driven adapters for official governments, universities, scholarship bodies, employers and sponsor registers.
- Search-based discovery limited by configured policy and source rules.
- Normalized common and type-specific facts, original URL, canonical URL, captured evidence, extraction version, last checked time and lifecycle state.
- Idempotent scheduled ingestion, retries, duplicate merging and dead-letter records.
- No manual approval step in the normal publishing path.

### Automated confidence and safety

- Source tier, official/employer domain checks, deadline normalization, URL availability, material-change detection and sponsorship evidence.
- Separate source confidence and sponsorship confidence.
- Vacancy sponsorship evidence is distinct from employer sponsor eligibility.
- Suspicious payment language, domain mismatch, redirect anomalies and contradictory dates contribute to risk signals.
- Results below configured publish thresholds are suppressed automatically; incomplete but safe evidence can be shown with an explicit label.
- Users can report a listing, triggering a recheck.

The "checker" is therefore not a separate gimmick in beta. Confidence and risk checking are core infrastructure embedded in every opportunity detail. A public Sponsor/Risk Checker belongs to Phase 20 because it can later serve acquisition.

### Matching and readiness

- Evaluate hard requirements deterministically using pass/fail/unknown/not-applicable.
- Evaluate soft fit separately with versioned weights.
- Produce score, confidence, matched reasons, gaps, disqualifiers, missing data and recommended next actions.
- Cite opportunity requirement evidence in explanations.
- Readiness is pathway-specific and based on user-controlled inputs, documents and preparation tasks.
- Next Best Action is selected by impact, urgency and feasibility and remains explainable.
- Recompute after material profile or opportunity changes.

### Dashboard and opportunity experience

- Approved Direction A desktop/mobile composition.
- Live greeting, profile readiness, next action, applications, IELTS status and top matches.
- Search, personalized feed, saved/dismissed state and filters for type, country, occupation/field, funding/salary, sponsorship confidence, IELTS, deadline and match strength.
- Detail view includes source, last check, official link, requirements, benefits, documents, deadlines, confidence, match reasons, gaps and report/share actions.
- Expired or withdrawn status cannot be hidden.

### Documents and applications

- Private user-scoped storage, file validation, versioning, categories and expiry metadata.
- Signed short-lived access; no public document URLs.
- Opportunity-specific workspace and checklist.
- Statuses: Interested, Preparing, Ready, Submitted, Assessment, Interview, Offer, Accepted, Rejected, Withdrawn.
- Internal and official deadlines, notes, reminders and immutable status history.
- Mobile camera/file picker and recoverable upload experience.

### CV and application assistant

- CV structure review, profile consistency, role alignment and evidence-based improvement suggestions.
- Country/occupation-aware format guidance represented as guidance, not legal fact.
- Tailored CV, cover letter, motivation letter, personal statement, essay, study plan, impact statement and recruiter message where appropriate.
- Collect facts/evidence first. Never invent accomplishments, employers, qualifications or metrics.
- Word-limit, tone, evidence and consistency validation.
- Draft/revision history and exports; provider quotas and cost controls.

### Notifications

- Telegram linking and verified email preferences.
- Instant, daily, weekly and deadline-only options; quiet hours and timezone.
- Match, deadline, missing document, interview and expiration events.
- Deduplicated delivery with retries, suppression and deep links.

### Payments and entitlements

- Configurable plans and entitlements, not UI-hard-coded authorization.
- Provider adapter, hosted/secure checkout, server verification and signed webhook handling.
- Idempotent ledger/reconciliation for purchase, renewal, cancellation, expiry, refund and failed payment.
- Meter premium matches, AI usage, analyses and alert capabilities.
- Downgrade preserves user data while enforcing access.

### IELTS beta foundation

- Academic/General selection, diagnostic, original timed reading, original writing tasks, speaking recording/transcript, estimated feedback, targets, history and study recommendation.
- Content provenance/licence status is mandatory for each item.
- Never copy protected past papers merely because they are discoverable online.
- Clearly label AI/practice bands as unofficial estimates and link official resources.

## 5. Information architecture

Primary mobile navigation: Home, Explore, Applications, Prepare, Profile.
Desktop navigation: Home, Opportunities, My Applications, Readiness, Saved, Messages, Profile.

`Prepare` contains Documents, CV/Application Assistant, IELTS and later Interview Studio. Desktop routes may expose these through Readiness/contextual links without changing the approved sidebar labels.

## 6. Data architecture

Use Supabase Postgres with UUID primary keys, `created_at`, `updated_at` and explicit ownership. Suggested bounded contexts:

| Context          | Principal records                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity         | profiles, consents, notification_preferences, audit_events                                                                                                             |
| Passport         | user_goals, education_records, employment_records, skills, user_skills, certifications, trade_experience, language_profiles, country_preferences, profile_versions     |
| Supply           | opportunities, opportunity_requirements, benefits, documents, sources, source_registry, sponsorship_evidence, opportunity_versions, ingestion_runs, ingestion_failures |
| Intelligence     | match_results, match_factors, readiness_snapshots, next_actions, feedback_events                                                                                       |
| Preparation      | user_documents, document_versions, applications, application_requirements, application_status_events, drafts, draft_sources, ai_usage                                  |
| Learning         | ielts_content, ielts_attempts, ielts_responses, feedback, study_plans                                                                                                  |
| Delivery/revenue | notification_events, deliveries, telegram_links, products, prices, entitlements, payment_customers, payment_events, usage_ledger                                       |

Requirements must use structured operators and values plus evidence references. Do not encode eligibility only in prose. Preserve original extracted text alongside normalized values.

All user-owned tables require RLS policies for select/insert/update/delete. System ingestion tables permit writes only through server roles. Public/client queries must use curated views or server APIs that exclude internal extraction traces and secrets.

## 7. Service boundaries

- Web app: Next.js App Router and server-side authorization.
- Database/auth/storage: Supabase.
- Jobs: idempotent Vercel Cron endpoints initially; move long-running collection to a queue/worker once runtime limits require it.
- Providers: internal interfaces for AI, discovery/search, payments, email and Telegram.
- AI outputs: versioned Zod/JSON schemas, bounded input, validation and rejected-output logs.
- Fetching: SSRF-safe outbound service with allow/deny checks, response-size/time limits and redirect validation.

## 8. Non-functional requirements

### Security/privacy

- Least privilege, server-only secrets, strict RLS, private storage and short-lived signed URLs.
- Rate limiting for auth, generation, uploads, reports, linking and public-ish search endpoints.
- MIME/signature validation and documented malware-scanning strategy.
- Prompt-injection defense: fetched content is untrusted data, never instructions.
- Logs redact CVs, document contents, access tokens, contact data and sensitive profile fields.
- Account deletion and export jobs are auditable and retryable.

### Performance/reliability

- Responsive on a mid-range Android device under throttled 4G.
- Avoid large initial dashboard payloads; paginate feeds and lazy-load heavy preparation tools.
- Optimized responsive images and font subsets.
- Idempotency keys for jobs, webhook events and notification events.
- Visible retry/recovery for network-sensitive user operations.

### Accessibility

- WCAG 2.2 AA target; semantic landmarks, labels, contrast, focus visibility, keyboard access and reduced-motion support.
- Touch targets at least 44×44 CSS px.

### Observability

- Structured server logs, error tracking, job/provider metrics and correlation IDs.
- Funnel events: registration, onboarding completion, first useful match, save, workspace, submitted application, alert click, upgrade, AI export and outcome.
- Do not send sensitive document/profile content to analytics.

## 9. Design acceptance

- Use the exact palette and composition rules in the design source of truth.
- Desktop and mobile are separately composed.
- The top handwritten route says “Your next step is a bigger story.”
- The sidebar route says “A brighter tomorrow. A wider you.”
- Both are responsive SVG/custom artwork, not omitted approximations.
- The mobile Opportunity Path is a purpose-built route graphic, not a crop of desktop art.
- No default component-library aesthetic, arbitrary gradients or crowded card wall.

## 10. Out of beta scope

- Marketing landing page.
- Automatic final application submission.
- Native mobile apps.
- Full licensed-equivalent IELTS mock catalogue.
- Exhaustive regulator/licensing roadmaps.
- Partner portals/referral payouts.
- Public fit/sponsor/risk tools.
- Any guarantee of visa, sponsorship, scholarship, admission, interview or job.

## 11. Success and release criteria

Primary activation: a user finds a relevant match and creates a real application workspace. Track onboarding completion, time to useful match, strong-match availability, save/workspace/submission rate, paid conversion, CAC, 7/30-day return, alert engagement, AI export, outcomes, match-dismiss reasons, freshness/error rate and cost per paid active user.

Release requires the complete beta journey, automated multi-source supply, mobile acceptance, security review, provider reconciliation, no fake placeholders and documented operational recovery.
