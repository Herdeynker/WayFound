# Phase 12 requirement checklist

| Requirement | Implementation and verification evidence | Status |
| --- | --- | --- |
| Founder-approved launch plans | Versioned `weekly`, `monthly` and `yearly` NGN prices are seeded by `20260908100000`; hosted integration and pricing UI tests verify identical paid feature access. | Complete |
| No free trial | Closed database status domains, immediate-charge checkout, pricing copy, unit/component tests and final source scan exclude trial access. | Complete |
| Server-authoritative plan mapping | Checkout accepts only an internal plan code; `model.ts` resolves the versioned price, interval, NGN amount and configured Paystack plan code. Unit and hosted tests reject tampered inputs. | Complete |
| Paystack provider boundary | `provider.ts` implements server-only plan validation, checkout initialization, verification, subscription lookup/management, cancellation, timeouts, safe GET retries and normalized errors. | Complete |
| Checkout safety | Owner-bound intent is written before provider initialization; references and callback URLs are server-created; duplicate checkout protection and redirect URL validation are covered by tests. | Complete |
| Verified payment activation | `service.ts` verifies transaction status, reference, amount, currency, email, plan, environment and paid time before the database RPC can grant access. | Complete |
| Signed webhook inbox | Webhook route reads the raw body and uses timing-safe HMAC SHA-512 verification; the hosted test proves deterministic duplicate delivery and minimal inbox storage. | Complete |
| Payment and subscription records | Hosted migration creates normalized service-owned records, constrained internal statuses and append-oriented payment history; RLS tests deny client mutation. | Complete |
| Entitlements | Hosted RPC grants only verified paid periods, preserves paid-through cancellation, expires periods and revokes refund/reversal sources; replay is a true no-op. | Complete |
| Usage metering | Database-configured limits and atomic idempotent RPCs meter advanced matches, CV analysis, AI documents and premium alerts; 31-way concurrency proves the 30-use boundary. | Complete |
| Failure and reconciliation | Webhook/reconciliation paths handle failed invoices, cancellation, expiry, refund/reversal, duplicate/out-of-order events and provider subscription repair. Hosted tests verify the resulting states. | Complete |
| Billing and pricing UI | Direction A pricing and billing screens cover active, non-renewing, attention, expired, loading, empty, error, stale, permission and provider-disabled states on desktop and mobile. | Complete |
| Server-side paywall | Assistant page and analyse/generate/export APIs enforce current entitlements server-side; billing, account, privacy, authentication and onboarding remain available. | Complete |
| RLS and service boundaries | Hosted anonymous/User A/User B and forged-owner checks deny cross-user access and financial/configuration writes; webhook and operational RPCs remain service-only. | Complete |
| Safe plan changes | Billing UI and service support non-renewal followed by a new purchase, preserve paid-through access and explicitly avoid proration, credits and silent refunds. | Complete |
| Provider-disabled operation | Missing Paystack configuration renders an unavailable state, disables checkout controls and never simulates success; component and visual tests verify it. | Complete |
| Accessibility and responsive evidence | Playwright verifies semantic actions and responsive layouts; the final visual suite produces application-only 1440×900 and 390×844 evidence under `artifacts/phase-12/`. | Complete |
| Security and privacy | The schema stores no full card data or raw provider payload; URL, signature, RLS, secret, environment and client-bundle checks verify the server boundary. | Complete |
| Scope boundary | Changed-file and route review confirms no Phase 13 IELTS implementation, landing page, payouts or automatic application submission. | Complete |
