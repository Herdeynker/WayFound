# WAYFOUND Onboarding Optimization

## Purpose

The Opportunity Passport activation journey now asks for the smallest honest set of facts that can support useful initial opportunity ranking. The previous eleven visible steps remain represented in the normalized Passport model, but only four activation stages are shown to new users. Detailed evidence is progressive enrichment, not an activation barrier.

Flow version: `onboarding.optimized.v1`.

## Four-stage structure

1. **Goals** — active pathways plus preferred destinations or an explicit open-destinations choice.
2. **Background** — citizenship and residence plus the education, occupation, or trade basis required by the chosen pathways.
3. **Experience** — compact pathway-specific signals, shared skills, and optional progressive-disclosure fields.
4. **Review** — grouped confirmation, missing/deferred facts, edit actions, and the final matching consent boundary.

Onboarding progress is stage progress (25%, 50%, 75%, 100%). Passport readiness is a separate long-term completeness measure. A user can finish activation and see real opportunities without a 100% Passport.

## Minimum activation dataset

Every pathway requires:

- at least one active goal;
- a destination or `open to suitable destinations`;
- citizenship country;
- residence country.

Study, scholarship, fellowship, research, graduate and education-led internship pathways additionally require qualification level, academic field and graduation status.

Professional sponsorship and employment-led internship pathways additionally require current/recent occupation, employment status, approximate experience start year and one core skill.

Skilled/trade pathways additionally require trade/occupation, a practical-experience range, certification status and licence/registration status. `0`, `unknown`, `not held`, and `not applicable` are explicit values rather than missing values.

## Required and optional information

Required fields are labelled in the interface and are validated before stage advancement and again before confirmation. Grade/classification, basic language-test status, research summary and professional credential status are optional during activation. Full histories, exact scores, publications, awards, evidence, references, portfolios, CV and document uploads remain post-onboarding enrichment.

No inferred default is used to claim eligibility. Missing facts remain unknown in matching and readiness. CV upload is optional; proposals remain untrusted until the user explicitly accepts them, and the private storage/scanner controls are unchanged.

## Conditional and multi-goal behavior

The pathway flags are derived from stable goal identifiers. Academic, research, professional and trade cards are shown only when relevant. Shared questions, especially citizenship, residence and skills, render once for multi-goal users. Removing a goal hides its conditional card but does not erase previously entered information; shared data therefore remains available to any remaining pathway.

## Previous-step coverage

| Previous visible step | New location | Decision |
| --- | --- | --- |
| Your goals | Goals | Retained and condensed |
| About you | Background | Universal essentials retained; other profile details deferred |
| Destinations | Goals | Combined with goals; open-destination choice retained |
| Academic history | Background + Experience | Qualification/field/status retained; grade optional; full history deferred |
| Professional history | Background + Experience | Occupation/status/experience basis retained; employers and narratives deferred |
| Skills | Experience | Shared once across applicable goals |
| Certifications | Experience + Passport enrichment | Compact status optional/conditional; detailed records deferred |
| Skilled/trade experience | Background + Experience | Occupation, experience and honest credential/licence states retained |
| Language profile | Experience + Passport enrichment | Basic status optional; exact tests and scores deferred |
| Document readiness | Documents/Getting Started after activation | No upload required during onboarding |
| Review | Review | Retained as grouped confirmation with edit actions |

No old field or normalized table is removed. Existing eleven-step drafts are interpreted through `mapLegacySectionToStage`: goals/destinations → Goals, origin → Background, the seven detailed record steps → Experience, and review → Review.

## Autosave and resume

The server-owned `onboarding_progress.draft` remains authoritative. Writes are debounced by 700ms, unchanged restored drafts are not rewritten, and every stage transition flushes the current answers. A load failure disables autosave so an empty client state cannot overwrite a server draft. Save failures remain visible until a real retry succeeds. Legacy and four-stage positions resume through the same API across devices.

## Confirmation, versioning and matching

Confirmation uses `phase16_confirm_onboarding` as one owner-bound database transaction. It:

- verifies authenticated ownership and current required consent;
- validates the activation shape and readiness bounds;
- serializes confirmation per user with an advisory transaction lock;
- replaces the user’s normalized Passport rows without touching another owner;
- creates an immutable profile version for a material Passport change;
- reuses the latest equivalent snapshot instead of duplicating it;
- queues the new profile version exactly once for deterministic rematching;
- marks the four-stage activation complete while retaining separate Passport readiness.

Record IDs are removed from the material snapshot because they are storage identity, not matching facts. Reverting to genuinely different historical facts creates a new chronological version. The opportunity feed reads matches for the latest profile version only, which supersedes stale prior-profile matches; safe broader opportunities remain separately labelled.

## Routing, consent and payment

The protected sequence remains signup → verification → consent → onboarding → pricing/payment when required → dashboard. Passport APIs and the confirmation RPC enforce consent. Checkout still requires consent and a confirmed Passport. A completed user who opens `/onboarding` is sent to the correct pricing or dashboard destination; explicit Passport editing uses `/onboarding?edit=1` and does not restart activation.

## Analytics

The privacy-safe event vocabulary includes `onboarding_started`, `onboarding_stage_viewed`, `onboarding_stage_completed`, `onboarding_stage_abandoned`, `onboarding_resumed`, `onboarding_completed`, `optional_field_deferred`, and `review_edit_requested`. Properties are limited to stable stage, flow-version, pathway and closed detail identifiers. Raw answers, names, CV text, document names, contact information and credentials are not accepted. Idempotency keys include stable event context and server revision.

`onboarding_started_at` and `completed_at` permit aggregate completion-time measurement without collecting raw form answers. Stage events support completion, abandonment, resume and pathway comparisons.

## Accessibility and responsive behavior

The flow uses semantic fieldsets, headings, native controls, labelled errors, an alert summary with focus restoration, keyboard-operable disclosure widgets and explicit text status in addition to colour. Desktop uses a concise four-stage panel. Mobile uses a four-column compact indicator in normal document flow, 44px controls and reachable sticky actions without nested scrolling. Reduced-motion behavior continues through the global design system.

## Database and security

Migration `20260908140002_onboarding_optimization.sql` adds four-stage metadata, Passport readiness, completion timestamps, snapshot fingerprints and a service-only rematching queue. It relaxes only the incorrect requirement that every certification must have an expiry, while adding chronological date validation. RLS remains enabled, the queue grants no client access, new rows cascade on account deletion, and normalized user records remain owner-isolated.

## Evidence and verification

Production visual evidence is stored only under `artifacts/onboarding-optimization/`. Unit, component, hosted integration/RLS, Playwright, visual, accessibility, build, audit, migration, secret and client-bundle checks are recorded in the companion requirements checklist.
