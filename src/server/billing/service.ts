import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { z } from "zod";
import type {
  BillingFeatureCode,
  BillingPlanCode,
  BillingPlanView,
  BillingSummaryView,
} from "@/features/billing/types";
import { parseServerEnvironment } from "@/lib/env/schema";
import type { Database, Json } from "@/server/supabase/database.types";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import type { WayfoundSupabaseClient } from "@/server/supabase/types";
import {
  acceptedPaystackEvents,
  normalizeEmail,
  paystackTransactionSchema,
  paystackWebhookSchema,
  providerEventFingerprint,
  safeWebhookData,
  transactionPlanCode,
} from "./model";
import {
  BillingProviderError,
  configuredPlanCode,
  createPaystackProvider,
  paystackConfigured,
  type PaystackBillingProvider,
} from "./provider";

type AdminClient = SupabaseClient<Database, "public">;
type WebhookEvent = z.infer<typeof paystackWebhookSchema>;

export class BillingAccessError extends Error {
  readonly code: "ENTITLEMENT_REQUIRED" | "USAGE_LIMIT_REACHED" | "FEATURE_UNAVAILABLE";
  constructor(code: BillingAccessError["code"]) {
    super(code);
    this.name = "BillingAccessError";
    this.code = code;
  }
}

const planBadge = (code: BillingPlanCode): BillingPlanView["badge"] =>
  code === "monthly" ? "Most Popular" : code === "yearly" ? "Best Value" : undefined;

export async function getBillingCatalog(
  admin: AdminClient = createSupabaseAdminClient(),
): Promise<BillingPlanView[]> {
  const now = new Date().toISOString();
  const [plans, prices, features, planFeatures] = await Promise.all([
    admin.from("billing_plans").select("id,code,display_name,description,sort_order").eq("enabled", true),
    admin
      .from("billing_price_versions")
      .select("id,plan_id,version_code,amount_kobo,currency,interval")
      .eq("enabled", true)
      .lte("valid_from", now)
      .or(`valid_until.is.null,valid_until.gt.${now}`),
    admin.from("billing_features").select("id,code,display_name").eq("enabled", true),
    admin.from("billing_plan_features").select("plan_id,feature_id").eq("enabled", true),
  ]);
  if (plans.error || prices.error || features.error || planFeatures.error)
    throw new Error("Billing catalogue is unavailable");
  const featureNames = new Map((features.data ?? []).map((feature) => [feature.id, feature.display_name]));
  const planOrder = new Map((plans.data ?? []).map((plan) => [plan.id, plan.sort_order]));
  const configured = paystackConfigured();
  return (plans.data ?? [])
    .flatMap((plan) => {
      const price = prices.data?.find((candidate) => candidate.plan_id === plan.id);
      if (!price) return [];
      const code = plan.code as BillingPlanCode;
      return [
        {
          id: plan.id,
          code,
          name: plan.display_name,
          description: plan.description,
          priceVersionId: price.id,
          priceVersion: price.version_code,
          amountKobo: price.amount_kobo,
          currency: price.currency as "NGN",
          interval: price.interval as BillingPlanView["interval"],
          badge: planBadge(code),
          features: (planFeatures.data ?? [])
            .filter((item) => item.plan_id === plan.id)
            .flatMap((item) => featureNames.get(item.feature_id) ?? []),
          providerConfigured: configured,
        },
      ];
    })
    .sort((left, right) => (planOrder.get(left.id) ?? 0) - (planOrder.get(right.id) ?? 0));
}

function providerFromEnvironment(): PaystackBillingProvider {
  const env = parseServerEnvironment();
  if (!paystackConfigured(env)) throw new BillingProviderError("PROVIDER_DISABLED");
  return createPaystackProvider({
    secretKey: env.PAYSTACK_SECRET_KEY!,
    environment: env.PAYSTACK_ENVIRONMENT!,
    planCodes: {
      weekly: configuredPlanCode("weekly", env),
      monthly: configuredPlanCode("monthly", env),
      yearly: configuredPlanCode("yearly", env),
    },
  });
}

function callbackUrl(): string {
  const value = parseServerEnvironment().APP_URL;
  if (!value) throw new BillingProviderError("PROVIDER_DISABLED");
  const url = new URL("/billing/callback", value);
  const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error("Billing callback origin is invalid");
  return url.toString();
}

export async function initializeCheckout(input: {
  user: Pick<User, "id" | "email" | "email_confirmed_at">;
  plan: BillingPlanCode;
  idempotencyKey: string;
  admin?: AdminClient;
  provider?: PaystackBillingProvider;
}): Promise<{ authorizationUrl: string; reference: string; replayed: boolean }> {
  if (!input.user.email || !input.user.email_confirmed_at) throw new Error("VERIFIED_EMAIL_REQUIRED");
  const admin = input.admin ?? createSupabaseAdminClient();
  const provider = input.provider ?? providerFromEnvironment();
  const replay = await admin
    .from("billing_checkout_intents")
    .select("provider_reference,authorization_url,status,expires_at")
    .eq("user_id", input.user.id)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (
    replay.data?.authorization_url &&
    replay.data.status === "initialized" &&
    replay.data.expires_at > new Date().toISOString()
  ) {
    return {
      authorizationUrl: replay.data.authorization_url,
      reference: replay.data.provider_reference,
      replayed: true,
    };
  }

  const selected = (await getBillingCatalog(admin)).find((plan) => plan.code === input.plan);
  if (!selected) throw new Error("PLAN_UNAVAILABLE");
  const planCode = provider.planCode(input.plan);
  const providerPlan = await provider.fetchPlan(planCode);
  if (
    providerPlan.planCode !== planCode ||
    providerPlan.amountKobo !== selected.amountKobo ||
    providerPlan.currency !== selected.currency ||
    providerPlan.interval !== selected.interval ||
    providerPlan.environment.toLowerCase() !== provider.environment
  ) {
    throw new Error("PROVIDER_PLAN_MISMATCH");
  }

  const recent = await admin
    .from("billing_checkout_intents")
    .select("authorization_url,provider_reference")
    .eq("user_id", input.user.id)
    .eq("price_version_id", selected.priceVersionId)
    .eq("status", "initialized")
    .gt("created_at", new Date(Date.now() - 2 * 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent.data?.authorization_url) {
    return {
      authorizationUrl: recent.data.authorization_url,
      reference: recent.data.provider_reference,
      replayed: true,
    };
  }

  const reference = `WF${Date.now()}${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const intent = await admin
    .from("billing_checkout_intents")
    .insert({
      user_id: input.user.id,
      price_version_id: selected.priceVersionId,
      internal_plan_code: selected.code,
      price_version_code: selected.priceVersion,
      provider_plan_code: planCode,
      provider_reference: reference,
      idempotency_key: input.idempotencyKey,
      amount_kobo: selected.amountKobo,
      currency: selected.currency,
      interval: selected.interval,
    })
    .select("id")
    .single();
  if (intent.error) throw new Error("CHECKOUT_INTENT_FAILED");

  try {
    const initialized = await provider.initializeTransaction({
      email: input.user.email,
      amountKobo: selected.amountKobo,
      currency: selected.currency,
      reference,
      planCode,
      callbackUrl: callbackUrl(),
      metadata: {
        checkout_intent_id: intent.data.id,
        price_version_id: selected.priceVersionId,
        internal_plan: selected.code,
      },
    });
    if (initialized.reference !== reference) throw new Error("PROVIDER_REFERENCE_MISMATCH");
    const saved = await admin
      .from("billing_checkout_intents")
      .update({
        status: "initialized",
        authorization_url: initialized.authorizationUrl,
        initialized_at: new Date().toISOString(),
      })
      .eq("id", intent.data.id);
    if (saved.error) throw new Error("CHECKOUT_STATE_FAILED");
    return { authorizationUrl: initialized.authorizationUrl, reference, replayed: false };
  } catch (error) {
    await admin
      .from("billing_checkout_intents")
      .update({ status: "failed", failure_code: "provider_initialization_failed" })
      .eq("id", intent.data.id);
    throw error;
  }
}

export async function verifyCheckoutReference(input: {
  userId: string;
  email: string;
  reference: string;
  admin?: AdminClient;
  provider?: PaystackBillingProvider;
}): Promise<{ paymentId: string; alreadyVerified: boolean }> {
  return verifyCheckoutReferenceInternal(input);
}

async function verifyCheckoutReferenceInternal(input: {
  userId: string;
  email: string;
  reference: string;
  admin?: AdminClient;
  provider?: PaystackBillingProvider;
}): Promise<{ paymentId: string; alreadyVerified: boolean }> {
  const admin = input.admin ?? createSupabaseAdminClient();
  const provider = input.provider ?? providerFromEnvironment();
  const intent = await admin
    .from("billing_checkout_intents")
    .select("*")
    .eq("provider_reference", input.reference)
    .eq("user_id", input.userId)
    .single();
  if (intent.error || !intent.data) throw new Error("CHECKOUT_NOT_FOUND");

  const existing = await admin
    .from("billing_payments")
    .select("id")
    .eq("provider_reference", input.reference)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existing.data) return { paymentId: existing.data.id, alreadyVerified: true };

  const transaction = paystackTransactionSchema.parse(await provider.verifyTransaction(input.reference));
  const planCode = transactionPlanCode(transaction);
  if (
    transaction.status !== "success" ||
    transaction.reference !== intent.data.provider_reference ||
    transaction.amount !== intent.data.amount_kobo ||
    transaction.currency !== intent.data.currency ||
    normalizeEmail(transaction.customer.email) !== normalizeEmail(input.email) ||
    planCode !== intent.data.provider_plan_code ||
    !transaction.paid_at
  ) {
    throw new Error("PAYMENT_VERIFICATION_MISMATCH");
  }

  const fingerprint = createHash("sha256").update(`${transaction.id}:${transaction.reference}`).digest("hex");
  const result = await admin.rpc("phase12_record_verified_payment", {
    candidate_user_id: input.userId,
    candidate_checkout_intent_id: intent.data.id,
    candidate_provider_transaction_id: String(transaction.id),
    candidate_provider_customer_code: transaction.customer.customer_code,
    candidate_provider_subscription_code: transaction.subscription?.subscription_code ?? "",
    candidate_paid_at: transaction.paid_at,
    candidate_authorization_channel: transaction.authorization?.channel ?? undefined,
    candidate_authorization_brand: transaction.authorization?.brand ?? undefined,
    candidate_authorization_last4: transaction.authorization?.last4 ?? undefined,
    candidate_event_fingerprint: fingerprint,
  });
  if (result.error || !result.data) throw new Error("PAYMENT_RECORDING_FAILED");

  if (transaction.subscription?.email_token && transaction.subscription.subscription_code) {
    const subscription = await admin
      .from("billing_subscriptions")
      .select("id")
      .eq("provider_subscription_code", transaction.subscription.subscription_code)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (subscription.data) {
      await admin.from("billing_subscription_secrets").upsert({
        subscription_id: subscription.data.id,
        provider_email_token: transaction.subscription.email_token,
      });
    }
  }
  return { paymentId: result.data, alreadyVerified: false };
}

export async function hasPaidEntitlement(
  userId: string,
  admin: AdminClient = createSupabaseAdminClient(),
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await admin
    .from("billing_entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .limit(1);
  return !result.error && (result.data?.length ?? 0) > 0;
}

export async function requirePaidFeature(
  client: WayfoundSupabaseClient,
  feature: BillingFeatureCode,
  idempotencyKey: string,
): Promise<{ remaining: number | null }> {
  const result = await client.rpc("phase12_consume_usage", {
    candidate_feature_code: feature,
    candidate_quantity: 1,
    candidate_idempotency_key: idempotencyKey,
  });
  if (result.error) {
    if (result.error.message.includes("usage limit")) throw new BillingAccessError("USAGE_LIMIT_REACHED");
    if (result.error.message.includes("entitlement")) throw new BillingAccessError("ENTITLEMENT_REQUIRED");
    throw new BillingAccessError("FEATURE_UNAVAILABLE");
  }
  const value = result.data as { remaining?: number | null } | null;
  return { remaining: value?.remaining ?? null };
}

function asRecord(value: Json): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeDate(value: unknown, fallback = new Date()): Date {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function storeWebhookEvent(
  event: WebhookEvent,
  rawBody: string,
  admin: AdminClient = createSupabaseAdminClient(),
): Promise<{ duplicate: boolean; accepted: boolean }> {
  const data = safeWebhookData(event.data);
  const accepted = (acceptedPaystackEvents as readonly string[]).includes(event.event);
  const occurredAt = safeDate(data.created_at ?? data.paid_at);
  const fingerprint = providerEventFingerprint(rawBody);
  const inserted = await admin
    .from("billing_provider_events")
    .insert({
      event_type: event.event,
      event_fingerprint: fingerprint,
      provider_reference: typeof data.reference === "string" ? data.reference : null,
      provider_subscription_code: typeof data.subscription_code === "string" ? data.subscription_code : null,
      provider_customer_code: typeof data.customer_code === "string" ? data.customer_code : null,
      occurred_at: occurredAt.toISOString(),
      safe_data: data as Json,
      status: accepted ? "pending" : "ignored",
      processed_at: accepted ? null : new Date().toISOString(),
    })
    .select("id")
    .single();
  if (!inserted.error) return { duplicate: false, accepted };
  const duplicate = await admin
    .from("billing_provider_events")
    .select("id")
    .eq("event_fingerprint", fingerprint)
    .maybeSingle();
  if (duplicate.data) return { duplicate: true, accepted };
  throw new Error("WEBHOOK_STORAGE_FAILED");
}

async function findSubscriptionForEvent(admin: AdminClient, data: Record<string, unknown>) {
  const code = typeof data.subscription_code === "string" ? data.subscription_code : null;
  if (code) {
    const byCode = await admin
      .from("billing_subscriptions")
      .select("*")
      .eq("provider_subscription_code", code)
      .maybeSingle();
    if (byCode.data) return byCode.data;
  }
  const customer = typeof data.customer_code === "string" ? data.customer_code : null;
  const plan = typeof data.plan_code === "string" ? data.plan_code : null;
  if (!customer || !plan) return null;
  const recent = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("provider_customer_code", customer)
    .eq("provider_plan_code", plan)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return recent.data ?? null;
}

async function updateSubscriptionFromEvent(
  admin: AdminClient,
  eventType: string,
  data: Record<string, unknown>,
  occurredAt: string,
) {
  const subscription = await findSubscriptionForEvent(admin, data);
  if (!subscription) return;
  if (subscription.last_provider_event_at && subscription.last_provider_event_at > occurredAt) return;
  const futureAccess = Boolean(
    subscription.current_period_end && subscription.current_period_end > new Date().toISOString(),
  );
  const updates: Database["public"]["Tables"]["billing_subscriptions"]["Update"] = {
    last_provider_event_at: occurredAt,
    provider_status: typeof data.status === "string" ? data.status.slice(0, 80) : eventType,
  };
  if (eventType === "subscription.create") {
    updates.provider_subscription_code =
      typeof data.subscription_code === "string"
        ? data.subscription_code
        : subscription.provider_subscription_code;
    updates.status = subscription.cancel_at_period_end ? "non_renewing" : "active";
    updates.next_payment_at =
      typeof data.next_payment_date === "string" ? data.next_payment_date : subscription.next_payment_at;
  } else if (eventType === "subscription.not_renew" || eventType === "subscription.disable") {
    updates.status = futureAccess ? "non_renewing" : "cancelled";
    updates.cancel_at_period_end = true;
    updates.cancelled_at = occurredAt;
    updates.next_payment_at = null;
    if (!futureAccess) updates.ended_at = occurredAt;
  } else if (eventType === "invoice.payment_failed" || eventType === "subscription.expiring_cards") {
    updates.status = futureAccess ? "attention" : "past_due";
    updates.last_failed_payment_at = occurredAt;
  } else if (["invoice.create", "invoice.update"].includes(eventType)) {
    updates.next_payment_at =
      typeof data.next_payment_date === "string" ? data.next_payment_date : subscription.next_payment_at;
  }
  await admin.from("billing_subscriptions").update(updates).eq("id", subscription.id);
  if (eventType === "subscription.create" && typeof data.email_token === "string") {
    await admin.from("billing_subscription_secrets").upsert({
      subscription_id: subscription.id,
      provider_email_token: data.email_token,
    });
  }
}

async function processProviderEvent(
  eventId: string,
  workerToken: string,
  admin: AdminClient,
  provider: PaystackBillingProvider,
): Promise<"processed" | "ignored"> {
  const event = await admin
    .from("billing_provider_events")
    .select("*")
    .eq("id", eventId)
    .eq("lease_token", workerToken)
    .single();
  if (event.error || !event.data) throw new Error("EVENT_NOT_CLAIMED");
  const data = asRecord(event.data.safe_data);
  const reference = typeof data.reference === "string" ? data.reference : event.data.provider_reference;

  if (event.data.event_type === "charge.success") {
    if (!reference) return "ignored";
    const intent = await admin
      .from("billing_checkout_intents")
      .select("user_id")
      .eq("provider_reference", reference)
      .maybeSingle();
    if (!intent.data) return "ignored";
    const account = await admin.auth.admin.getUserById(intent.data.user_id);
    if (!account.data.user?.email) throw new Error("CHECKOUT_ACCOUNT_UNAVAILABLE");
    await verifyCheckoutReferenceInternal({
      userId: intent.data.user_id,
      email: account.data.user.email,
      reference,
      admin,
      provider,
    });
  } else if (
    [
      "subscription.create",
      "subscription.not_renew",
      "subscription.disable",
      "invoice.create",
      "invoice.update",
      "invoice.payment_failed",
      "subscription.expiring_cards",
    ].includes(event.data.event_type)
  ) {
    await updateSubscriptionFromEvent(admin, event.data.event_type, data, event.data.occurred_at);
  } else if (["refund.processed", "charge.dispute.create"].includes(event.data.event_type)) {
    if (!reference) return "ignored";
    const payment = await admin
      .from("billing_payments")
      .select("id,subscription_id")
      .eq("provider_reference", reference)
      .maybeSingle();
    if (!payment.data) return "ignored";
    const revokedStatus = event.data.event_type === "refund.processed" ? "refunded" : "reversed";
    await admin.from("billing_payments").update({ status: revokedStatus }).eq("id", payment.data.id);
    await admin
      .from("billing_entitlements")
      .update({
        status: "revoked",
        revoked_at: event.data.occurred_at,
        revocation_reason: revokedStatus,
      })
      .eq("source_payment_id", payment.data.id)
      .eq("status", "active");
    if (payment.data.subscription_id) {
      await admin
        .from("billing_subscriptions")
        .update({ status: "attention", last_provider_event_at: event.data.occurred_at })
        .eq("id", payment.data.subscription_id);
    }
  } else if (event.data.event_type === "charge.dispute.resolve") {
    return "ignored";
  } else {
    return "ignored";
  }

  const scrubbed = { ...data };
  delete scrubbed.email_token;
  await admin
    .from("billing_provider_events")
    .update({ safe_data: scrubbed as Json })
    .eq("id", eventId)
    .eq("lease_token", workerToken);
  return "processed";
}

function billingFailureCode(error: unknown): { code: string; retryable: boolean } {
  if (error instanceof BillingProviderError)
    return { code: error.code.toLowerCase(), retryable: error.retryable };
  if (error instanceof Error && error.message === "PAYMENT_VERIFICATION_MISMATCH")
    return { code: "verification_mismatch", retryable: false };
  return { code: "processing_failed", retryable: true };
}

export async function runBillingReconciliation(
  input: {
    admin?: AdminClient;
    provider?: PaystackBillingProvider;
    limit?: number;
    idempotencyKey?: string;
  } = {},
): Promise<{
  claimed: number;
  processed: number;
  ignored: number;
  retried: number;
  failed: number;
  expired: number;
  subscriptionsChecked: number;
  subscriptionsRepaired: number;
}> {
  const admin = input.admin ?? createSupabaseAdminClient();
  const provider = input.provider ?? providerFromEnvironment();
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));
  const idempotencyKey = input.idempotencyKey ?? `billing:${new Date().toISOString().slice(0, 13)}`;
  const existing = await admin
    .from("billing_reconciliation_runs")
    .select("checked_count,repaired_count,failure_count,status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing.data?.status === "completed") {
    return {
      claimed: existing.data.checked_count,
      processed: existing.data.repaired_count,
      ignored: 0,
      retried: 0,
      failed: existing.data.failure_count,
      expired: 0,
      subscriptionsChecked: 0,
      subscriptionsRepaired: 0,
    };
  }
  await admin
    .from("billing_reconciliation_runs")
    .upsert({ idempotency_key: idempotencyKey, status: "running" }, { onConflict: "idempotency_key" });
  const result = {
    claimed: 0,
    processed: 0,
    ignored: 0,
    retried: 0,
    failed: 0,
    expired: 0,
    subscriptionsChecked: 0,
    subscriptionsRepaired: 0,
  };

  const subscriptions = await admin
    .from("billing_subscriptions")
    .select(
      "id,provider_subscription_code,provider_plan_code,provider_status,status,next_payment_at,cancel_at_period_end,current_period_end",
    )
    .in("status", ["active", "non_renewing", "attention", "past_due"])
    .not("provider_subscription_code", "is", null)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (subscriptions.error) throw new Error("BILLING_SUBSCRIPTIONS_UNAVAILABLE");
  for (const subscription of subscriptions.data ?? []) {
    result.subscriptionsChecked += 1;
    try {
      const remote = await provider.fetchSubscription(subscription.provider_subscription_code!);
      if (
        remote.subscription_code !== subscription.provider_subscription_code ||
        (remote.plan?.plan_code && remote.plan.plan_code !== subscription.provider_plan_code)
      ) {
        throw new Error("SUBSCRIPTION_VERIFICATION_MISMATCH");
      }
      const providerStatus = remote.status.trim().toLowerCase().replaceAll("-", "_");
      const hasPaidTime = Boolean(
        subscription.current_period_end && subscription.current_period_end > new Date().toISOString(),
      );
      const mappedStatus = (() => {
        if (subscription.cancel_at_period_end && hasPaidTime) return "non_renewing";
        if (providerStatus === "active") return "active";
        if (providerStatus === "non_renewing") return "non_renewing";
        if (providerStatus === "attention") return hasPaidTime ? "attention" : "past_due";
        if (providerStatus === "completed") return "completed";
        if (["cancelled", "canceled", "disabled"].includes(providerStatus))
          return hasPaidTime ? "non_renewing" : "cancelled";
        return subscription.status;
      })();
      const nextPaymentAt =
        mappedStatus === "active" || mappedStatus === "attention"
          ? (remote.next_payment_date ?? subscription.next_payment_at)
          : null;
      if (
        mappedStatus !== subscription.status ||
        providerStatus !== subscription.provider_status ||
        nextPaymentAt !== subscription.next_payment_at
      ) {
        const updated = await admin
          .from("billing_subscriptions")
          .update({
            status: mappedStatus,
            provider_status: providerStatus.slice(0, 80),
            next_payment_at: nextPaymentAt,
          })
          .eq("id", subscription.id);
        if (updated.error) throw new Error("SUBSCRIPTION_RECONCILIATION_FAILED");
        result.subscriptionsRepaired += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  const workerToken = randomUUID();
  const claim = await admin.rpc("phase12_claim_provider_events", {
    worker_token: workerToken,
    batch_limit: limit,
    lease_seconds: 120,
  });
  if (claim.error) throw new Error("BILLING_EVENT_CLAIM_FAILED");
  result.claimed = claim.data.length;
  for (const eventId of claim.data) {
    try {
      const outcome = await processProviderEvent(eventId, workerToken, admin, provider);
      result[outcome] += 1;
      await admin
        .from("billing_provider_events")
        .update({
          status: outcome,
          processed_at: new Date().toISOString(),
          lease_token: null,
          lease_expires_at: null,
          failure_code: null,
        })
        .eq("id", eventId)
        .eq("lease_token", workerToken);
    } catch (error) {
      const failure = billingFailureCode(error);
      const event = await admin
        .from("billing_provider_events")
        .select("attempt_count")
        .eq("id", eventId)
        .single();
      const retry = failure.retryable && (event.data?.attempt_count ?? 10) < 5;
      await admin
        .from("billing_provider_events")
        .update({
          status: retry ? "retry" : "failed",
          available_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          lease_token: null,
          lease_expires_at: null,
          failure_code: failure.code,
        })
        .eq("id", eventId)
        .eq("lease_token", workerToken);
      if (retry) result.retried += 1;
      else result.failed += 1;
    }
  }
  const expired = await admin.rpc("phase12_expire_entitlements");
  result.expired = expired.data ?? 0;
  await admin
    .from("billing_checkout_intents")
    .update({ status: "expired", failure_code: "checkout_expired" })
    .in("status", ["created", "initialized"])
    .lt("expires_at", new Date().toISOString());
  await admin
    .from("billing_reconciliation_runs")
    .update({
      status: result.failed > 0 ? "partial" : "completed",
      checked_count: result.claimed + result.subscriptionsChecked,
      repaired_count: result.processed + result.subscriptionsRepaired,
      failure_count: result.failed,
      completed_at: new Date().toISOString(),
    })
    .eq("idempotency_key", idempotencyKey);
  return result;
}

export async function getBillingSummary(
  userId: string,
  admin: AdminClient = createSupabaseAdminClient(),
): Promise<BillingSummaryView> {
  const catalog = await getBillingCatalog(admin);
  const [subscriptions, entitlements, payments, usage, planFeatures, features] = await Promise.all([
    admin
      .from("billing_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("billing_entitlements")
      .select("status,starts_at,ends_at,internal_plan_code")
      .eq("user_id", userId)
      .order("ends_at", { ascending: false })
      .limit(1),
    admin
      .from("billing_payments")
      .select("id,amount_kobo,currency,status,paid_at,internal_plan_code")
      .eq("user_id", userId)
      .order("paid_at", { ascending: false })
      .limit(20),
    admin.from("billing_usage_ledger").select("feature_id,quantity").eq("user_id", userId),
    admin.from("billing_plan_features").select("plan_id,feature_id,period_limit"),
    admin.from("billing_features").select("id,display_name"),
  ]);
  const subscription = subscriptions.data?.[0];
  const entitlement = entitlements.data?.[0];
  const currentPlan = catalog.find((plan) => plan.code === subscription?.internal_plan_code);
  const featureNames = new Map((features.data ?? []).map((feature) => [feature.id, feature.display_name]));
  const used = new Map<string, number>();
  for (const entry of usage.data ?? [])
    used.set(entry.feature_id, (used.get(entry.feature_id) ?? 0) + entry.quantity);
  return {
    providerConfigured: paystackConfigured(),
    currentPlan,
    subscription: subscription
      ? {
          status: subscription.status,
          startedAt: subscription.current_period_start ?? undefined,
          paidThrough: subscription.current_period_end ?? undefined,
          nextPaymentAt: subscription.next_payment_at ?? undefined,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        }
      : undefined,
    entitlement: entitlement
      ? { status: entitlement.status, startsAt: entitlement.starts_at, endsAt: entitlement.ends_at }
      : undefined,
    payments: (payments.data ?? []).map((payment) => ({
      id: payment.id,
      amountKobo: payment.amount_kobo,
      currency: payment.currency,
      status: payment.status,
      paidAt: payment.paid_at ?? undefined,
      planName: catalog.find((plan) => plan.code === payment.internal_plan_code)?.name ?? "WAYFOUND",
    })),
    usage: currentPlan
      ? (planFeatures.data ?? [])
          .filter((item) => item.plan_id === currentPlan.id)
          .map((item) => ({
            feature: featureNames.get(item.feature_id) ?? "Paid feature",
            used: used.get(item.feature_id) ?? 0,
            limit: item.period_limit,
          }))
      : [],
  };
}

export async function createSubscriptionManagementLink(input: {
  userId: string;
  admin?: AdminClient;
  provider?: PaystackBillingProvider;
}): Promise<string> {
  const admin = input.admin ?? createSupabaseAdminClient();
  const provider = input.provider ?? providerFromEnvironment();
  const subscription = await admin
    .from("billing_subscriptions")
    .select("provider_subscription_code")
    .eq("user_id", input.userId)
    .in("status", ["active", "non_renewing", "attention", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!subscription.data?.provider_subscription_code) throw new Error("SUBSCRIPTION_UNAVAILABLE");
  return provider.createManagementLink(subscription.data.provider_subscription_code);
}

export async function cancelSubscriptionRenewal(input: {
  userId: string;
  admin?: AdminClient;
  provider?: PaystackBillingProvider;
}): Promise<{ paidThrough?: string }> {
  const admin = input.admin ?? createSupabaseAdminClient();
  const provider = input.provider ?? providerFromEnvironment();
  const subscription = await admin
    .from("billing_subscriptions")
    .select("id,provider_subscription_code,status,current_period_end,cancel_at_period_end")
    .eq("user_id", input.userId)
    .in("status", ["active", "non_renewing", "attention", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!subscription.data?.provider_subscription_code) throw new Error("SUBSCRIPTION_UNAVAILABLE");
  if (subscription.data.cancel_at_period_end || subscription.data.status === "non_renewing")
    return { paidThrough: subscription.data.current_period_end ?? undefined };
  const secret = await admin
    .from("billing_subscription_secrets")
    .select("provider_email_token")
    .eq("subscription_id", subscription.data.id)
    .maybeSingle();
  if (!secret.data) throw new Error("MANAGEMENT_LINK_REQUIRED");
  await provider.disableSubscription(
    subscription.data.provider_subscription_code,
    secret.data.provider_email_token,
  );
  const now = new Date().toISOString();
  await admin
    .from("billing_subscriptions")
    .update({ status: "non_renewing", cancel_at_period_end: true, cancelled_at: now, next_payment_at: null })
    .eq("id", subscription.data.id)
    .eq("user_id", input.userId);
  return { paidThrough: subscription.data.current_period_end ?? undefined };
}

export function parseWebhook(rawBody: string): WebhookEvent {
  return paystackWebhookSchema.parse(JSON.parse(rawBody));
}
