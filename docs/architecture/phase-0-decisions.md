# WAYFOUND Phase 0 architecture decisions

## Next.js App Router

The application uses Next.js App Router with server components by default. Interactive components must opt into `"use client"`; server-only modules import `server-only`. The Phase 0 route is a small foundation status page, not the dashboard or marketing landing page.

## Supabase

Supabase is the planned system of record for authentication, Postgres and private storage. Phase 0 includes only a migration sentinel so the local migration path is testable without prematurely creating future product tables. User-owned tables and storage policies are introduced with their relevant phase migrations.

## Provider interfaces

AI, discovery, email, Telegram and payment calls go through typed interfaces in `src/server/providers`. Phase 0 supplies disabled adapters that throw `ProviderDisabledError`; they never return synthetic success. Real adapters require an explicit provider decision and credentials in a later phase.

## Migrations and generated types

Migrations are timestamp-prefixed SQL files under `supabase/migrations`. They should be additive and safe to replay where applicable. Run `npm run supabase:reset` locally to apply migrations and seed data, and `npm run supabase:types` after schema changes. Production migrations are applied through the Supabase project migration workflow after review.

## Background-job idempotency

Every job has a job name, run ID, correlation ID and caller-supplied idempotency key. `runIdempotentJob` checks completed keys before work and records structured success/failure metadata. The in-memory store is a development/test primitive; production jobs must use a durable store before launch. Vercel Cron requests must be authenticated with `CRON_SECRET` by the endpoint that owns the job.

## Mobile-first implementation

The foundation keeps mobile-safe viewport defaults, a responsive token entry point and Playwright projects at 360, 390, 412 and 430 CSS pixels. Product surfaces must be deliberately composed for mobile in the phase that introduces them.

## Server-only authorization and secrets

Service-role credentials are read only from server-only modules. Client code receives no server environment object. Authorization must be enforced in server code and Supabase RLS, never by client filtering.

## AI structured-output validation

Future AI adapters must accept a Zod schema and validate provider output before persistence or display. Phase 0 defines this boundary but does not call an external AI provider.

## Font-loading strategy

The CSS token entry point reserves `--font-inter` and `--font-sora` with system fallbacks. Phase 1 may self-host approved font subsets or configure a compliant font loader after visual review; no external font request is required by the foundation.

## Rate limiting and logging limitations

`InMemoryFixedWindowRateLimiter` is a local/test implementation only and is not claimed as production rate limiting. Production must use a shared durable limiter. Structured logs redact secrets, tokens, profile/document fields and contact data; sensitive payloads must never be passed to the logger.
