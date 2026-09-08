# WAYFOUND

Phase 2 foundation for the authenticated WAYFOUND application. The marketing landing page and Phase 3 passport are intentionally out of scope.

## Required software

- Node.js 20.9 or later
- npm 10 or later
- Supabase CLI 2.117 or later
- Docker Desktop is optional; the hosted WAYFOUND development project is the current migration target

This repository uses npm and commits `package-lock.json` for reproducible installs.

## Local setup

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Development uses the public Supabase URL/key in `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Server-only operations use `SUPABASE_SECRET_KEY`; it is never exposed to browser code. Google remains disabled until `GOOGLE_OAUTH_ENABLED=true` and the Supabase provider is configured. Never commit `.env` or `.env.local`.

## Supabase

For the hosted development project, inspect and apply migrations with `npx supabase migration list --linked`, `npx supabase db push --linked --dry-run`, `npx supabase db push --linked`, and `npx supabase db lint --linked --schema public --fail-on error`. Local Docker commands remain available for future isolated work. Add future migrations as timestamp-prefixed files under `supabase/migrations`, review them, and apply them through the Supabase migration workflow. See [Phase 0 decisions](docs/architecture/phase-0-decisions.md) and [Phase 2 account lifecycle](docs/architecture/phase-2-account-lifecycle.md).

## Quality commands

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:component
npm run test:integration
npm run test:e2e:list
npm run test:e2e
npm run build
```

Playwright starts the development server automatically and includes desktop plus 360, 390, 412 and 430 px mobile projects. Browser binaries may need `npx playwright install chromium` on a new machine. The health endpoint is `GET /health`.

## Architecture

External providers are accessed only through typed interfaces in `src/server/providers`. Disabled adapters fail honestly until a real provider is configured. Jobs use structured metadata and idempotency keys. Server logging is JSON-based and redacts sensitive fields. Security headers are configured in `next.config.ts`; the in-memory rate limiter is explicitly local/test-only.

## Deployment expectations

Vercel can build the app with `npm run build`. Configure required production environment variables in the deployment environment, keep service-role credentials server-only, and use a durable rate limiter and durable job store before production launch. Supabase migrations must be reviewed and applied separately.

## Known Phase 0 limitations

- Phase 2 includes authentication, protected routes, consent, account settings and lifecycle request foundations. Opportunity Passport, ingestion, matching, documents, payments, alerts and IELTS remain future phases.
- No external provider adapter is live.
- The health endpoint reports application/configuration readiness only; it does not perform a database connection check.
- Durable job persistence, distributed rate limiting, error-tracking delivery and malware scanning require later operational wiring.
- The approved design references are preserved under `docs/wayfound/`; the landing reference is brand-only and no landing route exists.
