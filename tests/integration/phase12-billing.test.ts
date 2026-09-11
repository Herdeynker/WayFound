import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/server/supabase/database.types";
import type { PaystackBillingProvider } from "@/server/billing/provider";
import {
  cancelSubscriptionRenewal,
  runBillingReconciliation,
  storeWebhookEvent,
} from "@/server/billing/service";

loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(url && publicKey && secretKey);
const testCase = live ? it : it.skip;
const admin = live
  ? createClient<Database>(url!, secretKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const users: string[] = [];

function userClient(storageKey: string) {
  return createClient<Database>(url!, publicKey!, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey },
  });
}

const provider = (disable = vi.fn()): PaystackBillingProvider => ({
  environment: "test",
  planCode: (plan) => `PLN_phase12_${plan}`,
  fetchPlan: async (planCode) => ({
    planCode,
    amountKobo: 2000000,
    currency: "NGN",
    interval: "monthly",
    environment: "test",
  }),
  initializeTransaction: async (input) => ({
    authorizationUrl: "https://checkout.paystack.com/synthetic",
    accessCode: "access",
    reference: input.reference,
  }),
  verifyTransaction: async () => {
    throw new Error("not needed in this hosted path");
  },
  fetchSubscription: async (code) => ({
    subscription_code: code,
    status: "active",
    next_payment_date: new Date(Date.now() + 86400000).toISOString(),
  }),
  createManagementLink: async () => "https://paystack.com/manage/subscriptions/synthetic",
  disableSubscription: disable,
});

describe("Phase 12 hosted billing, RLS and entitlement enforcement", () => {
  afterAll(async () => {
    if (!admin) return;
    for (const userId of users) expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
  }, 60_000);

  testCase(
    "keeps financial writes service-only and processes access idempotently",
    async () => {
      const password = `Phase12-${crypto.randomUUID()}-Safe!`;
      const [createdA, createdB] = await Promise.all(
        ["a", "b"].map((suffix) =>
          admin!.auth.admin.createUser({
            email: `phase12-${suffix}-${crypto.randomUUID()}@example.test`,
            password,
            email_confirm: true,
          }),
        ),
      );
      expect(createdA.error).toBeNull();
      expect(createdB.error).toBeNull();
      const userA = createdA.data.user!.id;
      const userB = createdB.data.user!.id;
      users.push(userA, userB);
      const clientA = userClient(`phase12-a-${crypto.randomUUID()}`);
      const clientB = userClient(`phase12-b-${crypto.randomUUID()}`);
      const anonymous = userClient(`phase12-anon-${crypto.randomUUID()}`);
      expect(
        (await clientA.auth.signInWithPassword({ email: createdA.data.user!.email!, password })).error,
      ).toBeNull();
      expect(
        (await clientB.auth.signInWithPassword({ email: createdB.data.user!.email!, password })).error,
      ).toBeNull();
      expect(
        (await clientA.from("profiles").upsert({ id: userA, first_name: "Synthetic" })).error,
      ).toBeNull();

      const monthly = await admin!.from("billing_plans").select("id").eq("code", "monthly").single();
      const price = await admin!
        .from("billing_price_versions")
        .select("id,version_code,amount_kobo,currency,interval")
        .eq("plan_id", monthly.data!.id)
        .eq("enabled", true)
        .single();
      expect(price.data).toMatchObject({ amount_kobo: 2000000, currency: "NGN", interval: "monthly" });
      const reference = `WF${crypto.randomUUID().replaceAll("-", "")}`;
      const originalCustomerCode = `CUS_${crypto.randomUUID()}`;
      const checkout = await admin!
        .from("billing_checkout_intents")
        .insert({
          user_id: userA,
          price_version_id: price.data!.id,
          internal_plan_code: "monthly",
          price_version_code: price.data!.version_code,
          provider_plan_code: "PLN_phase12_monthly",
          provider_reference: reference,
          idempotency_key: crypto.randomUUID(),
          amount_kobo: price.data!.amount_kobo,
          currency: price.data!.currency,
          interval: price.data!.interval,
          status: "initialized",
          authorization_url: "https://checkout.paystack.com/synthetic",
          initialized_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      expect(checkout.error).toBeNull();

      expect((await anonymous.from("billing_payments").select("id")).error).not.toBeNull();
      expect(
        (
          await clientA.from("billing_payments").insert({
            user_id: userA,
            plan_id: monthly.data!.id,
            price_version_id: price.data!.id,
            internal_plan_code: "monthly",
            price_version_code: price.data!.version_code,
            provider_reference: `WF${crypto.randomUUID().replaceAll("-", "")}`,
            provider_transaction_id: "forged",
            amount_kobo: 1,
            currency: "NGN",
            status: "succeeded",
          })
        ).error,
      ).not.toBeNull();
      expect(
        (await clientA.from("billing_checkout_intents").insert({ user_id: userB } as never)).error,
      ).not.toBeNull();
      expect(
        (await clientA.from("billing_price_versions").update({ amount_kobo: 1 }).eq("id", price.data!.id))
          .error,
      ).not.toBeNull();

      const paidAt = new Date(Date.now() - 60_000).toISOString();
      const payment = await admin!.rpc("phase12_record_verified_payment", {
        candidate_user_id: userA,
        candidate_checkout_intent_id: checkout.data!.id,
        candidate_provider_transaction_id: `TX_${crypto.randomUUID()}`,
        candidate_provider_customer_code: originalCustomerCode,
        candidate_provider_subscription_code: `SUB_${crypto.randomUUID()}`,
        candidate_paid_at: paidAt,
        candidate_authorization_channel: "card",
        candidate_authorization_brand: "visa",
        candidate_authorization_last4: "4081",
        candidate_event_fingerprint: "a".repeat(64),
      });
      expect(payment.error).toBeNull();
      const replay = await admin!.rpc("phase12_record_verified_payment", {
        candidate_user_id: userA,
        candidate_checkout_intent_id: checkout.data!.id,
        candidate_provider_transaction_id: `TX_replay_${crypto.randomUUID()}`,
        candidate_provider_customer_code: `CUS_${crypto.randomUUID()}`,
        candidate_provider_subscription_code: "",
        candidate_paid_at: paidAt,
      });
      expect(replay.data).toBe(payment.data);
      expect(
        (
          await admin!
            .from("billing_customers")
            .select("provider_customer_code")
            .eq("user_id", userA)
            .single()
        ).data?.provider_customer_code,
      ).toBe(originalCustomerCode);
      expect(
        (await admin!.from("billing_payments").select("id").eq("checkout_intent_id", checkout.data!.id)).data,
      ).toHaveLength(1);
      expect(
        (await admin!.from("billing_entitlements").select("id").eq("source_payment_id", payment.data!)).data,
      ).toHaveLength(1);
      expect((await clientA.from("billing_payments").select("id")).data).toHaveLength(1);
      expect((await clientB.from("billing_payments").select("id")).data).toHaveLength(0);
      expect(
        (await clientA.from("billing_payments").update({ amount_kobo: 2 }).eq("id", payment.data!)).error,
      ).not.toBeNull();
      expect(
        (
          await clientA.rpc("phase12_record_verified_payment", {
            candidate_user_id: userA,
            candidate_checkout_intent_id: checkout.data!.id,
            candidate_provider_transaction_id: "forged",
            candidate_provider_customer_code: "forged",
            candidate_provider_subscription_code: "",
            candidate_paid_at: paidAt,
          })
        ).error,
      ).not.toBeNull();

      const usageKeys = Array.from({ length: 31 }, () => crypto.randomUUID());
      const usage = await Promise.all(
        usageKeys.map((key) =>
          clientA.rpc("phase12_consume_usage", {
            candidate_feature_code: "ai_documents",
            candidate_quantity: 1,
            candidate_idempotency_key: key,
          }),
        ),
      );
      expect(usage.filter((result) => !result.error)).toHaveLength(30);
      expect(usage.filter((result) => result.error)).toHaveLength(1);
      expect(
        (
          await clientA.rpc("phase12_consume_usage", {
            candidate_feature_code: "ai_documents",
            candidate_quantity: 1,
            candidate_idempotency_key: usageKeys[0],
          })
        ).error,
      ).toBeNull();
      expect((await clientA.from("billing_usage_ledger").select("id")).data).toHaveLength(30);
      expect((await clientB.from("billing_usage_ledger").select("id")).data).toHaveLength(0);

      const subscription = await admin!
        .from("billing_subscriptions")
        .select("id,provider_subscription_code,current_period_end")
        .eq("user_id", userA)
        .single();
      expect(
        (
          await admin!
            .from("billing_subscription_secrets")
            .upsert({ subscription_id: subscription.data!.id, provider_email_token: "synthetic-token" })
        ).error,
      ).toBeNull();

      const failedRaw = JSON.stringify({
        event: "invoice.payment_failed",
        data: {
          subscription_code: subscription.data!.provider_subscription_code,
          status: "failed",
          created_at: new Date().toISOString(),
        },
      });
      expect((await storeWebhookEvent(JSON.parse(failedRaw), failedRaw, admin!)).duplicate).toBe(false);
      const failedRun = await runBillingReconciliation({
        admin: admin!,
        provider: provider(),
        idempotencyKey: `failed-${crypto.randomUUID()}`,
      });
      expect(failedRun.processed).toBe(1);
      expect(failedRun.subscriptionsChecked).toBe(1);
      expect(
        (await admin!.from("billing_subscriptions").select("status").eq("id", subscription.data!.id).single())
          .data?.status,
      ).toBe("attention");
      expect(
        (
          await admin!
            .from("billing_entitlements")
            .select("status")
            .eq("source_payment_id", payment.data!)
            .single()
        ).data?.status,
      ).toBe("active");

      const disable = vi.fn().mockResolvedValue(undefined);
      const cancelled = await cancelSubscriptionRenewal({
        userId: userA,
        admin: admin!,
        provider: provider(disable),
      });
      expect(cancelled.paidThrough).toBe(subscription.data!.current_period_end);
      await cancelSubscriptionRenewal({ userId: userA, admin: admin!, provider: provider(disable) });
      expect(disable).toHaveBeenCalledTimes(1);
      expect(
        (
          await admin!
            .from("billing_subscriptions")
            .select("status,cancel_at_period_end")
            .eq("id", subscription.data!.id)
            .single()
        ).data,
      ).toMatchObject({ status: "non_renewing", cancel_at_period_end: true });

      const refundRaw = JSON.stringify({
        event: "refund.processed",
        data: { reference, status: "processed", created_at: new Date().toISOString() },
      });
      const firstRefund = await storeWebhookEvent(JSON.parse(refundRaw), refundRaw, admin!);
      const duplicateRefund = await storeWebhookEvent(JSON.parse(refundRaw), refundRaw, admin!);
      expect(firstRefund.duplicate).toBe(false);
      expect(duplicateRefund.duplicate).toBe(true);
      const refundRun = await runBillingReconciliation({
        admin: admin!,
        provider: provider(),
        idempotencyKey: `refund-${crypto.randomUUID()}`,
      });
      expect(refundRun.processed).toBe(1);
      expect(
        (await admin!.from("billing_payments").select("status").eq("id", payment.data!).single()).data
          ?.status,
      ).toBe("refunded");
      expect(
        (
          await admin!
            .from("billing_entitlements")
            .select("status")
            .eq("source_payment_id", payment.data!)
            .single()
        ).data?.status,
      ).toBe("revoked");
      expect((await clientA.from("profiles").select("id").eq("id", userA)).data).toHaveLength(1);
      expect((await clientA.from("billing_provider_events").select("id")).error).not.toBeNull();
    },
    90_000,
  );
});
