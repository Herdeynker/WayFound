import "server-only";

import { z, type ZodType } from "zod";
import type { BillingPlanCode } from "@/features/billing/types";
import { parseServerEnvironment, type ServerEnvironment } from "@/lib/env/schema";
import {
  isPaystackCheckoutUrl,
  isPaystackManagementUrl,
  paystackPlanSchema,
  paystackSubscriptionSchema,
  paystackTransactionSchema,
} from "./model";

const paystackEnvelope = z.object({ status: z.literal(true), message: z.string(), data: z.unknown() });

const initializeSchema = z.object({
  authorization_url: z.string().url(),
  access_code: z.string().min(4).max(200),
  reference: z.string().min(8).max(100),
});
const managementSchema = z.object({ link: z.string().url() });

export class BillingProviderError extends Error {
  readonly code:
    | "PROVIDER_DISABLED"
    | "PROVIDER_TIMEOUT"
    | "PROVIDER_TEMPORARY"
    | "PROVIDER_REJECTED"
    | "PROVIDER_INVALID_RESPONSE";
  readonly retryable: boolean;

  constructor(code: BillingProviderError["code"], retryable = false) {
    super("The payment provider could not complete this request.");
    this.name = "BillingProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface PaystackPlanSnapshot {
  planCode: string;
  amountKobo: number;
  currency: string;
  interval: string;
  environment: string;
}

export interface PaystackBillingProvider {
  readonly environment: "test" | "live";
  planCode(plan: BillingPlanCode): string;
  fetchPlan(planCode: string): Promise<PaystackPlanSnapshot>;
  initializeTransaction(input: {
    email: string;
    amountKobo: number;
    currency: "NGN";
    reference: string;
    planCode: string;
    callbackUrl: string;
    metadata: Record<string, string>;
  }): Promise<{ authorizationUrl: string; accessCode: string; reference: string }>;
  verifyTransaction(reference: string): Promise<z.infer<typeof paystackTransactionSchema>>;
  fetchSubscription(code: string): Promise<z.infer<typeof paystackSubscriptionSchema>>;
  createManagementLink(code: string): Promise<string>;
  disableSubscription(code: string, emailToken: string): Promise<void>;
}

export function paystackConfigured(env: ServerEnvironment = parseServerEnvironment()): boolean {
  return Boolean(
    env.PAYMENT_PROVIDER === "paystack" &&
    env.PAYSTACK_SECRET_KEY &&
    env.PAYSTACK_WEEKLY_PLAN_CODE &&
    env.PAYSTACK_MONTHLY_PLAN_CODE &&
    env.PAYSTACK_YEARLY_PLAN_CODE &&
    env.PAYSTACK_ENVIRONMENT,
  );
}

export function configuredPlanCode(
  plan: BillingPlanCode,
  env: ServerEnvironment = parseServerEnvironment(),
): string {
  const value = {
    weekly: env.PAYSTACK_WEEKLY_PLAN_CODE,
    monthly: env.PAYSTACK_MONTHLY_PLAN_CODE,
    yearly: env.PAYSTACK_YEARLY_PLAN_CODE,
  }[plan];
  if (!value || !/^[A-Za-z0-9_-]{4,100}$/.test(value)) throw new BillingProviderError("PROVIDER_DISABLED");
  return value;
}

export function createPaystackProvider(input: {
  secretKey: string;
  environment: "test" | "live";
  planCodes: Record<BillingPlanCode, string>;
  fetcher?: typeof fetch;
}): PaystackBillingProvider {
  const fetcher = input.fetcher ?? fetch;

  async function request<T>(
    method: "GET" | "POST",
    path: string,
    schema: ZodType<T>,
    body?: unknown,
    safeRetry = false,
  ): Promise<T> {
    const attempts = safeRetry ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetcher(`https://api.paystack.co${path}`, {
          method,
          headers: {
            authorization: `Bearer ${input.secretKey}`,
            "content-type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(12_000),
          cache: "no-store",
        });
        if ((response.status === 429 || response.status >= 500) && attempt + 1 < attempts) continue;
        if (response.status === 429 || response.status >= 500)
          throw new BillingProviderError("PROVIDER_TEMPORARY", true);
        if (!response.ok) throw new BillingProviderError("PROVIDER_REJECTED");
        const envelope = paystackEnvelope.safeParse(await response.json().catch(() => null));
        if (!envelope.success) throw new BillingProviderError("PROVIDER_INVALID_RESPONSE");
        const parsed = schema.safeParse(envelope.data.data);
        if (!parsed.success) throw new BillingProviderError("PROVIDER_INVALID_RESPONSE");
        return parsed.data;
      } catch (error) {
        if (error instanceof BillingProviderError) throw error;
        const timeout = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
        if (attempt + 1 < attempts) continue;
        throw new BillingProviderError(timeout ? "PROVIDER_TIMEOUT" : "PROVIDER_TEMPORARY", true);
      }
    }
    throw new BillingProviderError("PROVIDER_TEMPORARY", true);
  }

  return {
    environment: input.environment,
    planCode: (plan) => input.planCodes[plan],
    async fetchPlan(planCode) {
      const plan = await request(
        "GET",
        `/plan/${encodeURIComponent(planCode)}`,
        paystackPlanSchema,
        undefined,
        true,
      );
      return {
        planCode: plan.plan_code,
        amountKobo: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        environment: plan.domain,
      };
    },
    async initializeTransaction(values) {
      const data = await request("POST", "/transaction/initialize", initializeSchema, {
        email: values.email,
        amount: String(values.amountKobo),
        currency: values.currency,
        reference: values.reference,
        plan: values.planCode,
        callback_url: values.callbackUrl,
        metadata: JSON.stringify(values.metadata),
      });
      if (!isPaystackCheckoutUrl(data.authorization_url))
        throw new BillingProviderError("PROVIDER_INVALID_RESPONSE");
      return {
        authorizationUrl: data.authorization_url,
        accessCode: data.access_code,
        reference: data.reference,
      };
    },
    verifyTransaction: (reference) =>
      request(
        "GET",
        `/transaction/verify/${encodeURIComponent(reference)}`,
        paystackTransactionSchema,
        undefined,
        true,
      ),
    fetchSubscription: (code) =>
      request(
        "GET",
        `/subscription/${encodeURIComponent(code)}`,
        paystackSubscriptionSchema,
        undefined,
        true,
      ),
    async createManagementLink(code) {
      const data = await request(
        "GET",
        `/subscription/${encodeURIComponent(code)}/manage/link`,
        managementSchema,
        undefined,
        true,
      );
      if (!isPaystackManagementUrl(data.link)) throw new BillingProviderError("PROVIDER_INVALID_RESPONSE");
      return data.link;
    },
    async disableSubscription(code, emailToken) {
      await request("POST", "/subscription/disable", z.unknown(), { code, token: emailToken });
    },
  };
}

export function createConfiguredPaystackProvider(
  env: ServerEnvironment = parseServerEnvironment(),
): PaystackBillingProvider {
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
