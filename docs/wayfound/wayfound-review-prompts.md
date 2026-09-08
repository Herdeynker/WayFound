# WAYFOUND Independent Review and Repair Prompts

## How to run a phase review

Start a fresh Codex review turn after the implementation turn. Paste the universal review prompt followed by the phase-specific gate. The reviewer must inspect actual code and evidence, not trust the previous summary.

## Universal review-and-repair prompt

```text
Act as an independent senior engineer, security reviewer, QA lead and product-design reviewer for WAYFOUND. Review the just-completed phase; do not trust its completion report. First read all canonical files under /docs/wayfound, inspect AGENTS.md, git diff/status, migrations, generated types, policies, package scripts and tests. Map the phase requirements to concrete files and tests.

Find omissions, stubs, hard-coded demo data in production paths, unreachable UI, unsafe assumptions, authorization/RLS flaws, broken mobile behavior, inaccessible interactions, missing states, provider failures, concurrency/idempotency bugs, unsupported claims and visual deviations. Run the most relevant lint, typecheck, unit/integration, migration, production-build and Playwright checks. Inspect the UI at 360, 390, 412, 430, 768, 1024, 1280 and 1680 px where relevant. Test as unauthenticated user, user A, user B and server job where data boundaries apply.

Classify findings Critical/High/Medium/Low with evidence. Then repair every Critical, High and in-scope Medium issue now, without expanding into future phases. Add regression tests, rerun checks and report exact results. Do not say “looks good” without a requirement-by-requirement matrix. Do not fabricate command output, screenshots or provider success. If external credentials prevent a live check, validate the adapter with deterministic fixtures and list the exact pending production check.

Final response must include: verdict PASS or FAIL; requirements coverage table; findings and repairs; commands with outcomes; database/RLS evidence; mobile/accessibility evidence; security/privacy evidence; unresolved blockers; manual acceptance checklist. PASS is allowed only when no Critical/High finding or failed required check remains.
```

## Phase-specific gates

### Phase 0 gate

```text
Review Phase 0. Prove clean install, environment validation, migration path, CI rejection behavior, provider boundaries, server-only secrets, security headers, rate-limit primitive and safe /health response. Search client bundles/source for privileged env access. Confirm all canonical docs/images exist and landing-page work was not introduced.
```

### Phase 1 gate

```text
Review Phase 1. Compare rendered dashboard at approved desktop/mobile viewports with reference images. Verify exact palette, hierarchy, density, desktop sidebar, mobile bottom nav, both exact handwritten route messages, custom SVG behavior, Opportunity Path variants, safe areas, 44px targets, keyboard focus, reduced motion and zero page overflow. Fail generic default-library styling or omitted decorative signatures.
```

### Phase 2 gate

```text
Review Phase 2. Exercise registration, verification, login, recovery, magic link, Google cancellation/config fallback, logout, route protection, consent versioning, export request and deletion. Prove user A/user B isolation and revoked/expired-session handling. Inspect audit/log redaction and safe redirect behavior.
```

### Phase 3 gate

```text
Review Phase 3. Complete each pathway and multi-goal combination on mobile. Verify conditional questions, autosave/resume/backtracking, normalized snapshots, completion logic, contradictory/missing state and user-confirmed CV proposals. Interrupt network/upload and prove recovery. Run RLS/storage isolation tests.
```

### Phase 4 gate

```text
Review Phase 4. Validate structured requirements and provenance using the four required cross-country fixtures. Prove source text survives normalization/versioning, lifecycle is expressible and employer-register status cannot masquerade as vacancy sponsorship. Inspect migrations, constraints, indexes, RLS and safe read views.
```

### Phase 5 gate

```text
Review Phase 5. Replay recorded sources twice, change one source, corrupt one extraction and fail one adapter. Prove idempotency, duplicate merging, versioning, isolation of failure, strict AI rejection, bounded fetch behavior, authenticated cron, resume and dead-letter handling. Check fetched content cannot instruct the model/system.
```

### Phase 6 gate

```text
Review Phase 6. Test official/unofficial domains, redirects, unavailable links, contradictory deadlines, expiration, employer-only register evidence, strong vacancy evidence and suspicious payment text. Verify explainable separate scores, automatic suppression thresholds, honest labels, recheck deduplication and absence of manual approval.
```

### Phase 7 gate

```text
Review Phase 7. Run all persona and edge fixtures. Prove hard failure, unknown and not-applicable are distinct; missing data cannot become eligibility; soft similarity cannot conceal a disqualifier; each explanation cites evidence; versions/recalculation are deterministic; Next Best Action is traceable.
```

### Phase 8 gate

```text
Review Phase 8. Use real seeded database records, not component constants. Verify dashboard values, all filters/search/pagination combinations, save/dismiss idempotency, detail provenance, confidence, gaps, official link, share/report and stale/expired handling. Compare desktop/mobile visually, including carousel and filter drawer, and test every empty/error/offline state.
```

### Phase 9 gate

```text
Review Phase 9. Attempt cross-user metadata and object access, spoof MIME/extension, oversize, expired signed URL and interrupted upload. Verify application uniqueness, checklist mapping, all valid status transitions, immutable history, deadline/reminder behavior and mobile camera/file flow. Ensure analytics/logs contain no document contents.
```

### Phase 10 gate

```text
Review Phase 10. Seed malicious opportunity/CV text and unsupported achievement requests. Prove source-fact approval, no silent profile changes, fact consistency, schema rejection, timeout/retry/quota concurrency, version history and mobile resume. Open exported DOCX/PDF and verify content/layout. Fail any invented accomplishment.
```

### Phase 11 gate

```text
Review Phase 11. Generate duplicate/out-of-order events, provider errors, quiet-hour boundaries, invalid/expired link tokens, unsubscribe/unlink and unsafe redirect attempts. Prove outbox durability, deduplication, retry/suppression, timezone behavior, authorization of deep links and no pipeline blocking.
```

### Phase 12 gate

```text
Review Phase 12. Simulate signed valid, duplicate, replayed, forged and out-of-order webhooks plus cancellation, expiry, refund and reconciliation. Prove entitlement enforcement is server-side, quota consumption is atomic and downgrade preserves data. Confirm no card data or client-trusted success and prices/limits are configurable.
```

### Phase 13 gate

```text
Review Phase 13. Audit every active item for provenance/licence status. Verify diagnostic, timers/resume, deterministic reading score, writing/speaking schema and unofficial labels. Test denied microphone permission, weak network, interrupted recording upload and mobile completion. Search for copied/unlicensed past-paper content and fail if found.
```

### Phase 14 gate

```text
Review Phase 14 as a production release audit. Re-run threat model, every RLS/storage isolation test, SSRF/prompt-injection/upload/webhook/cron abuse tests, backup/recovery exercise, full beta Playwright journey, payment reconciliation and responsive/accessibility/performance checks. Inspect analytics/logs for sensitive fields and production UI for fixtures, fake metrics, unsupported claims or policy placeholders. PASS only with zero Critical/High issues and no unresolved legal-text blocker.
```

### Phase 15 gate

```text
Review Phase 15. Audit audio/question provenance, scoring, transcript accessibility, adaptive-plan correctness, mobile playback/upload resilience and unofficial estimate language. Fail any copied past paper or unlicensed audio.
```

### Phase 16 gate

```text
Review Phase 16. Verify opportunity grounding, STAR rubric consistency, recording consent/retention/deletion, private media access, low-bandwidth fallbacks and no hiring-outcome predictions.
```

### Phase 17 gate

```text
Review Phase 17. Sample every approved jurisdiction/occupation against stored official evidence, date/version and change monitor. Verify stale suppression, costs/time qualification and disclaimer treatment. Fail unsourced legal/licensing claims.
```

### Phase 18 gate

```text
Review Phase 18. Test attribution conflicts, self-referral, duplicate identity, concurrent credit events, reversals and export boundaries. Prove ledger idempotency and partner isolation. Confirm no unapproved reward/payout terms appear.
```

### Phase 19 gate

```text
Review Phase 19. Test malicious third-party fields/pages, mapping mistakes, answer preview/diff, per-field approval, audit, unsupported sites and final submission boundary. Fail bypasses, CAPTCHA evasion, concealed automation or automatic declarations/submission.
```

### Phase 20 gate

```text
Review Phase 20. Verify public tools reuse governed evidence engines, are rate-limited, collect minimum data, express uncertainty and cannot access private records. Test adversarial inputs and account-conversion handoff. Fail guarantees or public leakage.
```

## Founder manual acceptance checklist per phase

- Open the primary new workflow on a 360–390 px Android viewport and complete it without desktop help.
- Repeat the main workflow on desktop.
- Confirm the design still feels like the approved WAYFOUND direction, not a generic dashboard.
- Confirm all promised buttons/actions work and no placeholder is presented as live.
- Force one empty state and one error/offline state.
- For user data, test with two accounts and confirm isolation.
- Read every eligibility/confidence/AI statement and reject anything that sounds guaranteed or invented.
- Do not proceed while the review verdict is FAIL.

## Final whole-product audit prompt

```text
Perform a fresh end-to-end audit of WAYFOUND Phases 0–14 against all canonical requirements. Ignore prior PASS claims. Build a bidirectional traceability matrix: every requirement -> implementation -> test, and every major implementation -> authorized requirement. Identify missing, partial, duplicated, contradictory or out-of-scope work. Run clean install/migrations, lint, typecheck, all tests, production build and desktop/mobile Playwright journeys. Audit RLS/storage, jobs/idempotency, extraction provenance, confidence, matching, payments, notifications, AI grounding, IELTS licensing, privacy/logging, accessibility, responsive fidelity and operational recovery. Repair all in-scope Critical/High/Medium defects, rerun evidence and produce a final PASS/FAIL launch report. Do not declare paid-beta ready if the real profile-to-application journey, live provider verification, approved legal copy or a critical operational runbook remains incomplete.
```
