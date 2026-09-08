# WAYFOUND

Phase 0 foundation for the authenticated WAYFOUND application. The marketing landing page and final dashboard are intentionally out of scope.

## Required software

- Node.js 20.9 or later
- npm 10 or later
- Docker Desktop and the Supabase CLI for local database work

This repository uses npm and commits `package-lock.json` for reproducible installs.

## Local setup

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Development does not require provider credentials; unavailable providers use controlled disabled adapters. Production requires `APP_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never commit `.env` or `.env.local`.

## Supabase

Start local Supabase with `npm run supabase:start`, apply migrations and seed data with `npm run supabase:reset`, and regenerate database types with `npm run supabase:types`. Add future migrations as timestamp-prefixed files under `supabase/migrations`, review them, and apply them through the Supabase migration workflow. See [Phase 0 decisions](docs/architecture/phase-0-decisions.md).

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

- No authentication, product dashboard, opportunity ingestion, matching, documents, payments, alerts or IELTS features are implemented.
- No external provider adapter is live.
- The health endpoint reports application/configuration readiness only; it does not perform a database connection check.
- Durable job persistence, distributed rate limiting, error-tracking delivery and malware scanning require later operational wiring.
- The approved design references are preserved under `docs/wayfound/`; the landing reference is brand-only and no landing route exists.
