import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { billingPlanCodes } from "@/features/billing/types";

export const billingPlanCodeSchema = z.enum(billingPlanCodes);

export const checkoutRequestSchema = z
  .object({
    plan: billingPlanCodeSchema,
    idempotencyKey: z.string().uuid(),
  })
  .strict();

const paystackAuthorizationSchema = z
  .object({
    channel: z.string().max(40).optional().nullable(),
    brand: z.string().max(40).optional().nullable(),
    last4: z
      .string()
      .regex(/^\d{4}$/)
      .optional()
      .nullable(),
  })
  .passthrough()
  .optional()
  .nullable();

const paystackCustomerSchema = z
  .object({
    customer_code: z.string().min(4).max(100),
    email: z.string().email(),
  })
  .passthrough();

export const paystackTransactionSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    status: z.string(),
    reference: z.string().min(8).max(100),
    amount: z.number().int().positive(),
    currency: z.string(),
    paid_at: z.string().datetime({ offset: true }).optional().nullable(),
    customer: paystackCustomerSchema,
    authorization: paystackAuthorizationSchema,
    plan: z
      .union([
        z.string(),
        z.object({ plan_code: z.string().optional(), code: z.string().optional() }).passthrough(),
      ])
      .optional()
      .nullable(),
    subscription: z
      .object({ subscription_code: z.string().optional(), email_token: z.string().optional() })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

export const paystackPlanSchema = z
  .object({
    plan_code: z.string().min(4).max(100),
    amount: z.number().int().positive(),
    currency: z.string(),
    interval: z.string(),
    domain: z.string(),
  })
  .passthrough();

export const paystackSubscriptionSchema = z
  .object({
    subscription_code: z.string().min(4).max(100),
    email_token: z.string().min(6).max(300).optional(),
    status: z.string(),
    next_payment_date: z.string().datetime({ offset: true }).optional().nullable(),
    customer: paystackCustomerSchema.optional(),
    plan: z.object({ plan_code: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

export const acceptedPaystackEvents = [
  "charge.success",
  "subscription.create",
  "subscription.not_renew",
  "subscription.disable",
  "invoice.create",
  "invoice.update",
  "invoice.payment_failed",
  "subscription.expiring_cards",
  "refund.processed",
  "charge.dispute.create",
  "charge.dispute.resolve",
] as const;

export const paystackWebhookSchema = z
  .object({
    event: z.string().min(3).max(80),
    data: z.record(z.unknown()),
  })
  .strict();

export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const suppliedBuffer = Buffer.from(signature.toLowerCase(), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function providerEventFingerprint(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function transactionPlanCode(transaction: z.infer<typeof paystackTransactionSchema>): string | null {
  if (typeof transaction.plan === "string") return transaction.plan || null;
  return transaction.plan?.plan_code ?? transaction.plan?.code ?? null;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isPaystackCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.paystack.com";
  } catch {
    return false;
  }
}

export function isPaystackManagementUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "paystack.com" &&
      url.pathname.startsWith("/manage/subscriptions/")
    );
  } catch {
    return false;
  }
}

export function safeWebhookData(data: Record<string, unknown>): Record<string, unknown> {
  const customer =
    typeof data.customer === "object" && data.customer ? (data.customer as Record<string, unknown>) : {};
  const plan = typeof data.plan === "object" && data.plan ? (data.plan as Record<string, unknown>) : {};
  const subscription =
    typeof data.subscription === "object" && data.subscription
      ? (data.subscription as Record<string, unknown>)
      : {};
  const invoice =
    typeof data.invoice === "object" && data.invoice ? (data.invoice as Record<string, unknown>) : {};
  const safe: Record<string, unknown> = {};
  const copy = (key: string, value: unknown, max = 200) => {
    if (typeof value === "string" && value.length > 0 && value.length <= max) safe[key] = value;
    if (typeof value === "number" && Number.isSafeInteger(value)) safe[key] = value;
    if (typeof value === "boolean") safe[key] = value;
  };
  copy("reference", data.reference ?? invoice.reference);
  copy("transaction_id", data.id);
  copy("status", data.status);
  copy("amount", data.amount);
  copy("currency", data.currency);
  copy("paid_at", data.paid_at);
  copy("created_at", data.created_at);
  copy("next_payment_date", data.next_payment_date);
  copy("customer_code", customer.customer_code ?? data.customer_code);
  copy("customer_email", customer.email);
  copy("subscription_code", data.subscription_code ?? subscription.subscription_code);
  copy("plan_code", plan.plan_code ?? data.plan_code);
  copy("email_token", data.email_token ?? subscription.email_token, 300);
  return safe;
}
