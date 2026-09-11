# Phase 12 billing and entitlements

WAYFOUND Phase 12 adds recurring Paystack billing and a server-authoritative paid-access boundary. The launch catalogue contains Weekly (₦7,000), Monthly (₦20,000) and Yearly (₦80,000) plans. Every plan unlocks the same paid feature categories; only price, billing duration and renewal interval differ. There is no free trial.

## Commercial model

Stable internal plan codes (`weekly`, `monthly`, `yearly`) are separate from provider plan codes and display labels. Each accepted checkout points to an immutable price version. New prices must be introduced as new, non-overlapping versions through a forward migration or controlled server operation; historical payments and active subscriptions retain the version they accepted.

The Monthly plan is labelled **Most Popular**. The Yearly plan is labelled **Best Value** and states both its approximate ₦6,667 monthly equivalent and its ₦160,000 nominal saving against twelve ₦20,000 monthly payments. Checkout charges immediately and renews on the selected Paystack interval until renewal is cancelled.

## Trust boundaries

- The browser submits only a closed internal plan code and a UUID idempotency key. Amount, currency, interval, price version and Paystack plan code come from server-controlled configuration and database records.
- An owner-bound checkout intent and server-generated reference are persisted before Paystack is called. A rapid repeat or an idempotent replay reuses the safe existing intent.
- An authorization URL or callback query never activates access. WAYFOUND verifies the transaction server-to-server and compares reference, status, amount, NGN currency, account email, plan code and payment time before recording it.
- `billing_payments` and `billing_entitlements` are created only by the service-role RPC. An exact replay returns the existing payment before changing customer, subscription or entitlement state.
- Paid access requires a current, non-revoked entitlement sourced from a verified successful payment. The protected CV-analysis, AI-document and premium-alert operations enforce and meter that boundary on the server.
- Billing, account, privacy, authentication, onboarding and basic opportunity discovery remain reachable without paid access.

## Paystack provider

The server-only adapter supports plan lookup, transaction initialization and verification, subscription lookup, hosted management links and non-renewal. It validates provider envelopes and HTTPS Paystack URLs, uses a 12-second timeout, retries only safe reads once, and maps failures to closed internal error categories. POST operations are not automatically retried.

The webhook reads the exact raw body and verifies `x-paystack-signature` using HMAC SHA-512 and the Paystack secret key with a timing-safe comparison. It stores a SHA-256 replay fingerprint and only a small allowlisted event projection. Full provider payloads, card data and secrets are not persisted or logged. The acknowledgement path persists work; a bounded authenticated reconciliation worker claims and processes it later.

Relevant provider events include successful charges, subscription creation/non-renewal/disablement, invoice lifecycle and failed invoices, expiring-card signals, refunds and disputes. Unknown validly signed event types are recorded as ignored. Duplicate deliveries cannot create duplicate payments or entitlements.

The implementation follows Paystack's current official documentation for [transaction initialization and verification](https://paystack.com/docs/api/transaction/), [plans](https://paystack.com/docs/api/plan/), [subscriptions](https://paystack.com/docs/payments/subscriptions/), [subscription management](https://paystack.com/docs/api/subscription/) and [signed webhooks](https://paystack.com/docs/payments/webhooks/).

## Subscription lifecycle and reconciliation

Internal subscription states are constrained to pending, active, non-renewing, attention, past due, cancelled, completed or expired. Provider strings are retained only as diagnostic state and are explicitly mapped. Reconciliation safely refreshes nonterminal subscriptions from Paystack, processes leased webhook events, expires elapsed entitlements and marks abandoned checkout intents without granting access.

Cancelling means stopping renewal. Already-paid access remains until the recorded paid-through time unless a verified refund, reversal or fraud state revokes it. Cancellation is idempotent. Launch plan changes intentionally use cancel-then-purchase; WAYFOUND does not invent proration, credits or automatic refunds.

An invoice failure marks the subscription as attention or past due but never fabricates a renewal or grace period. Existing access ends at the verified paid-through time. Refund and dispute events revoke only the entitlement sourced from the affected payment and preserve the user's profile, documents and applications.

## Data and authorization

The normalized model contains plans, price versions, features, plan-feature limits, checkout intents, provider customer mappings, subscriptions, separately protected cancellation tokens, append-oriented payments, entitlements, an idempotent usage ledger, a minimal provider-event inbox and reconciliation runs. `billing_adjustment_codes` is an inactive service-only schema boundary for future canonical work; Phase 12 exposes no coupon, discount, referral redemption, credit or payout workflow.

Every Phase 12 table has RLS enabled. Authenticated users can select only their own safe checkout, subscription, payment, entitlement and usage records. They cannot write financial state, forge ownership, call service functions, inspect provider events or modify plan configuration. Anonymous users receive no billing-record access.

## Configuration and operation

Only variable names and non-secret defaults appear in `.env.example`:

- `PAYMENT_PROVIDER=paystack`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_WEEKLY_PLAN_CODE`
- `PAYSTACK_MONTHLY_PLAN_CODE`
- `PAYSTACK_YEARLY_PLAN_CODE`
- `PAYSTACK_ENVIRONMENT=test|live`
- `APP_URL`
- `CRON_SECRET`
- `BILLING_CRON_ENABLED`
- `BILLING_BATCH_SIZE`

Secrets and real plan codes belong in ignored local configuration or the deployment secret manager. No Paystack public key is needed because checkout uses a hosted redirect. Test and live keys, plans and `PAYSTACK_ENVIRONMENT` must agree; a mismatch stops checkout.

Create the three Paystack plans with the exact NGN kobo amounts and intervals, place their codes in the matching secure variables, configure the webhook URL as `/api/billing/webhook`, and invoke `POST /api/internal/billing` with the cron bearer secret. When configuration is incomplete, the UI and worker report an unavailable state and never simulate provider success.

## Verification

Unit tests cover strict input validation, signatures, safe payload projection, URL allowlists and retry policy. Component and Playwright suites cover the exact prices, disclosures, cancellation, recovery states, keyboard operation and responsive layouts. Hosted integration tests prove RLS isolation, service-only writes, replay safety, atomic concurrent usage limits, failed-payment handling, cancellation, event deduplication and revocation while preserving user data. Production evidence is stored only under `artifacts/phase-12/`.
