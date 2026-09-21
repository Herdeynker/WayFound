# Conditional onboarding pathway repair

This corrective change preserves the existing four stages: Goals, Background,
Experience, and Review. It does not alter applied database migrations or
introduce Phase 17 scope.

| Requirement | Implementation and evidence |
| --- | --- |
| One concise Stage 3 route for a single pathway | `activePathways` and `resolveFocusPath` deterministically select the only active route. |
| Multi-route users choose before personalising | Stage 3 displays accessible route cards plus an explicit exploring option. |
| Deferred routes remain active and honest | Goals are retained in the draft and review labels deferred routes as broader discovery, never a score. |
| Exploring has no route-specific requirement | Activation needs shared background plus the explicit exploring selection only. |
| No hidden-route validation | Client and domain activation both scope requirements to the resolved focus path. |
| Draft and legacy compatibility | `focusPath` is optional with a null default in the existing owner-scoped JSON draft. No focus-state migration is necessary. |
| Snapshot and rematch idempotency | The selected focus is in the canonical snapshot; existing fingerprint/RPC reuse remains the transaction boundary. |
| Privacy-safe analytics | Focus events carry only stage, flow version, and enumerated pathway detail. A forward-only migration extends the database event allowlist without storing form answers. |
| Real opportunity integrity | Dashboard data continues through the hosted opportunity feed; fixtures are test-only. |
| Confirm/save ordering | The browser waits for in-flight autosaves before stage changes and final confirmation, preventing a stale draft from lowering a confirmed user's onboarding completion. Hosted production-mode captures assert the stored completion and paid dashboard access. |
| Post-confirmation dashboard | Confirmed Passport checklist completion uses onboarding completion, not full optional profile readiness. Missing match scores are labelled unavailable instead of telling a confirmed user to complete onboarding again. |
| Evidence | 188 combined tests, 53 component tests, 21 hosted integration/RLS tests, 145 behavioural Playwright checks, and 92 production visual checks pass. The browser and visual suites retain 115 and 353 intentional project-specific viewport skips respectively. Fresh desktop and 390×844 mobile pathway evidence, including authenticated development-project dashboards, is stored in `artifacts/onboarding-pathway-fix/`. Historical Phase 9/16 regression screenshots were redirected to disposable test output during final verification and remain unchanged. |
| Hosted verification | Forward-only migration `20260917110000` is recorded remotely; the final linked dry run is up to date and linked lint reports no schema errors. |
| Release checks | Production build, formatting, lint, typecheck, production dependency audit, changed-file secret scan, and static client-bundle secret scan pass. |
