# WAYFOUND Implementation Package

Status: Canonical execution guide
Scope: Logged-in application; the marketing landing page is excluded
Product release boundary: Paid beta after Phase 14

## 1. How to use this package

Give Codex these files and images in the repository before Phase 0:

- `wayfound-approved-design-source-of-truth.md`
- `wayfound-product-build-plan.md`
- `wayfound-technical-prd.md`
- `wayfound-requirements-traceability.md`
- `wayfound-phase-prompts.md`
- `wayfound-review-prompts.md`
- `wayfound-approved-dashboard-desktop.png`
- `wayfound-approved-dashboard-mobile.png`
- `wayfound-approved-landing-page.png` (brand reference only; do not build it)

Execute one phase at a time. For each phase:

1. Create a clean branch or checkpoint.
2. Paste the phase's implementation prompt from `wayfound-phase-prompts.md`.
3. Let Codex inspect the repository, implement, test and report.
4. Paste the matching review prompt from `wayfound-review-prompts.md` in a fresh review turn.
5. Require Codex to repair every in-scope issue, rerun verification and provide evidence.
6. Manually perform the short user-acceptance checklist.
7. Commit only after the phase gate passes.

Do not paste all implementation prompts into one coding turn. The package is prepared at once; the software is implemented sequentially so failures remain diagnosable.

## 2. Authority order

If documents appear to conflict, use this precedence:

1. Latest written founder decision recorded in the technical PRD.
2. Approved design source of truth for visual and responsive behavior.
3. Requirements traceability matrix for scope coverage.
4. Phase prompt for the current phase.
5. Product build plan for sequencing and background.

Codex must report a conflict instead of silently choosing or inventing a requirement.

## 3. Locked decisions

- Product name: WAYFOUND.
- Brand direction: Direction A — Trusted Navigator.
- Initial market: Nigerians; architecture supports additional African origins.
- Destinations are global and include China, the UK, Canada, Australia, Germany, Ireland, the Netherlands, the US and New Zealand.
- Opportunity types include scholarships, fellowships, graduate programmes, research roles, internships, sponsored professional jobs and sponsored skilled/trade work.
- No manual opportunity approval. Automated confidence, provenance, freshness, duplicate and sponsorship checks are required.
- No automatic final submission in beta. Users review and perform declarations/submission.
- IELTS content must be original or properly licensed. Practice scores are estimates, never represented as official IELTS scores.
- Every included workflow must be fully usable on mobile in the same phase it is introduced.
- No landing page is included in Phases 0–14.

## 4. Decisions that remain configurable

These must not block foundational development and must not be fabricated:

- Payment provider: implement an interface; select Paystack or another compatible provider before Phase 12 production wiring.
- AI provider/model: use an internal structured-output interface; Gemini may be the initial adapter.
- Search providers and source list: configured source registry, not hard-coded claims of exhaustive coverage.
- Exact prices, usage quotas and plan names: database/configuration values approved before launch.
- Retention periods and legal policy wording: configurable and reviewed before Phase 14 launch.
- Initial country depth: broad discovery is allowed, but confidence depends on actual source/evidence coverage.

## 5. Global definition of done

A phase is complete only if:

- Its requirements and acceptance criteria are implemented, not mocked unless explicitly permitted.
- Database migrations, generated types and row-level security are consistent.
- Tests were added at the correct layer and pass.
- Typecheck, lint and production build pass.
- Loading, empty, error, offline where applicable, and permission-denied states exist.
- The feature works at 360, 390, 412 and 430 px, plus tablet and desktop breakpoints.
- Keyboard navigation, focus, labels and touch targets are valid.
- Secrets and service-role access remain server-only.
- User-owned data is isolated by enforced authorization/RLS, not client filtering.
- No unsupported claims, fake data, fake metrics or invented eligibility are exposed as real.
- Documentation, environment examples and observability are updated.
- Codex supplies commands run, results, files changed, migrations added, known limitations and manual checks.

## 6. Beta launch journey

The paid beta is not ready until a real test user can register, consent, complete the Opportunity Passport, receive explainable matches, inspect evidence and gaps, save an opportunity, create an application workspace, upload a document, generate a fact-grounded draft, receive an alert, upgrade successfully, complete relevant IELTS practice and record an application outcome.

## 7. Stop conditions

Codex must stop and ask instead of guessing when:

- A destructive migration would remove real data.
- A required provider credential or commercial choice is unavailable and no safe adapter/mock boundary exists.
- Existing user changes conflict with the requested implementation.
- A legal/licensing question would require representing unverified material as authorized.
- The approved mock and written design rules materially conflict.

For ordinary implementation details, Codex should make a reversible, documented engineering choice and continue.
