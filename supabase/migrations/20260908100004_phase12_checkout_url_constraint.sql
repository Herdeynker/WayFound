-- Phase 12 forward-only repair: enforce the exact Paystack checkout origin.
alter table public.billing_checkout_intents
  drop constraint billing_checkout_authorization_url;

alter table public.billing_checkout_intents
  add constraint billing_checkout_authorization_url check (
    authorization_url is null or authorization_url like 'https://checkout.paystack.com/%'
  );
