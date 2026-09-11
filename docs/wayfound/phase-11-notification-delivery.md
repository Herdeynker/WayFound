# Phase 11 notification delivery

WAYFOUND Phase 11 adds consent-aware email and Telegram alerts without coupling notification delivery to matching, ingestion or an interactive request. Notification events are persisted first, deterministically deduplicated, expanded into channel deliveries and processed by a bounded worker.

## Architecture

- `notification_events` is the durable, owner-scoped outbox. The server derives its deduplication key from the user, event type, owned resource and occurrence key.
- `notification_deliveries` stores one delivery per event and channel, including scheduling, lease, retry and terminal state.
- `notification_delivery_attempts` records privacy-safe outcomes. It never stores message bodies, documents, CV contents, access tokens or provider secrets.
- `notification_suppressions` prevents delivery after unsubscribe or a terminal provider safety signal.
- `telegram_link_tokens` stores only SHA-256 token digests and expires each one-time link after 15 minutes.
- `telegram_links` stores the owner-bound Telegram destination and supports explicit unlinking.
- The worker claims a bounded batch through a service-role-only RPC. Matching and ingestion remain successful even when delivery is delayed or a provider is unavailable.

All new user-owned tables have row-level security enabled. Authenticated users may read only their own safe delivery metadata. Event creation, delivery claims, provider outcomes and Telegram callback consumption remain server-controlled.

## Scheduling and message safety

Email and Telegram frequencies are independently configurable as off, instant, daily, weekly or deadline-only. Scheduling uses the selected IANA timezone, honours quiet hours that cross midnight and keeps deadline calculations deterministic. Supported events are new match, strong match, application deadline, missing document, interview step, expired opportunity and withdrawn opportunity.

Templates use short generic summaries and closed, authenticated in-product links. They do not include raw CV text, private document contents, sensitive profile fields or provider credentials. Deep links are reconstructed from an allowed resource type and an owner-validated resource identifier rather than accepted as arbitrary URLs.

## Required server configuration

The following names are documented in `.env.example`; values belong only in an ignored local or deployment-secret environment:

- `RESEND_API_KEY` and `NOTIFICATION_EMAIL_FROM` enable email delivery.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and `TELEGRAM_WEBHOOK_SECRET` enable Telegram linking and webhook verification.
- `CRON_SECRET` authenticates the bounded internal worker route.
- `NOTIFICATIONS_CRON_ENABLED` explicitly enables scheduled processing.
- `NOTIFICATION_BATCH_SIZE` caps work claimed per invocation.

When any required provider value is absent, the interface and worker report that channel as unavailable; they do not simulate delivery success.

## Telegram setup

Configure the Telegram bot webhook to send HTTPS updates to `/api/notifications/telegram/webhook` and include the configured webhook secret in Telegram's secret-token header. The browser receives only the bot username and a one-time opaque link token. Bot credentials and chat identifiers never enter the client bundle.

## Worker operation

Invoke `POST /api/internal/notifications` from an external scheduler with `Authorization: Bearer <CRON_SECRET>`. Keep the schedule frequent enough for instant alerts while allowing the database to enforce daily, weekly, deadline-only and quiet-hour timing. Claims use short leases so an interrupted run can be retried. Provider calls have a bounded timeout and retry; repeated or permanent failures become explicit terminal states rather than false successes.

## Consent and lifecycle

Only a verified account email can receive email alerts. The latest consent decision for each channel is authoritative. Saving settings records an auditable consent decision, while unsubscribing disables email and creates a suppression. Telegram linking requires current Telegram consent; unlinking revokes the destination, disables Telegram delivery and prevents queued messages from being sent.

## Verification map

Unit tests cover validation, deduplication, schedule boundaries, safe templates, deep links and provider adapters. Component and Playwright tests cover the responsive preference centre and honest states. Hosted integration tests exercise anonymous/User A/User B isolation, forged-owner rejection, one-time/expired Telegram links, service-only worker claims, retries, recovery, unsubscribe and unlink behavior. The Phase 11 visual suite writes only synthetic evidence to `artifacts/phase-11/`.
