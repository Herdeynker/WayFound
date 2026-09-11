import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  checkoutRequestSchema,
  isPaystackCheckoutUrl,
  isPaystackManagementUrl,
  safeWebhookData,
  verifyPaystackSignature,
} from "@/server/billing/model";
import { BillingProviderError, createPaystackProvider } from "@/server/billing/provider";

const planCodes = { weekly: "PLN_weekly", monthly: "PLN_monthly", yearly: "PLN_yearly" };

describe("Phase 12 billing security model", () => {
  it("accepts only an internal plan and idempotency key", () => {
    expect(checkoutRequestSchema.parse({ plan: "monthly", idempotencyKey: crypto.randomUUID() }).plan).toBe(
      "monthly",
    );
    expect(() =>
      checkoutRequestSchema.parse({ plan: "monthly", idempotencyKey: crypto.randomUUID(), amount: 1 }),
    ).toThrow();
    expect(() => checkoutRequestSchema.parse({ plan: "pro", idempotencyKey: crypto.randomUUID() })).toThrow();
  });

  it("verifies the raw-body Paystack signature with HMAC SHA-512", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "WF-reference" } });
    const signature = createHmac("sha512", "server-secret").update(body).digest("hex");
    expect(verifyPaystackSignature(body, signature, "server-secret")).toBe(true);
    expect(verifyPaystackSignature(`${body} `, signature, "server-secret")).toBe(false);
    expect(verifyPaystackSignature(body, null, "server-secret")).toBe(false);
  });

  it("allows only exact hosted Paystack checkout and management URLs", () => {
    expect(isPaystackCheckoutUrl("https://checkout.paystack.com/abc123")).toBe(true);
    expect(isPaystackCheckoutUrl("https://checkout.paystack.com.evil.example/abc123")).toBe(false);
    expect(isPaystackManagementUrl("https://paystack.com/manage/subscriptions/abc?token=test")).toBe(true);
    expect(isPaystackManagementUrl("https://evil.example/manage/subscriptions/abc")).toBe(false);
  });

  it("retains only bounded reconciliation fields from webhook data", () => {
    const safe = safeWebhookData({
      id: 42,
      reference: "WF-reference",
      amount: 700000,
      currency: "NGN",
      authorization: { card_number: "4084084084084081", cvv: "123" },
      otp: "000000",
      customer: { customer_code: "CUS_test", email: "synthetic@example.test" },
    });
    expect(safe).toMatchObject({
      reference: "WF-reference",
      amount: 700000,
      currency: "NGN",
      customer_code: "CUS_test",
    });
    expect(JSON.stringify(safe)).not.toContain("408408");
    expect(safe).not.toHaveProperty("otp");
  });

  it("validates server-authoritative Paystack plan snapshots with bounded read retry", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: true,
            message: "ok",
            data: {
              plan_code: "PLN_monthly",
              amount: 2000000,
              currency: "NGN",
              interval: "monthly",
              domain: "test",
            },
          }),
          { status: 200 },
        ),
      );
    const provider = createPaystackProvider({
      secretKey: "test-secret",
      environment: "test",
      planCodes,
      fetcher,
    });
    await expect(provider.fetchPlan("PLN_monthly")).resolves.toMatchObject({
      amountKobo: 2000000,
      interval: "monthly",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not blindly retry transaction initialization", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const provider = createPaystackProvider({
      secretKey: "test-secret",
      environment: "test",
      planCodes,
      fetcher,
    });
    await expect(
      provider.initializeTransaction({
        email: "synthetic@example.test",
        amountKobo: 700000,
        currency: "NGN",
        reference: "WF1234567890123456",
        planCode: "PLN_weekly",
        callbackUrl: "https://app.example.test/billing/callback",
        metadata: {},
      }),
    ).rejects.toBeInstanceOf(BillingProviderError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
