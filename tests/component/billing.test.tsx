import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BillingManager } from "@/features/billing/billing-manager";
import { PricingExperience } from "@/features/billing/pricing-experience";
import type { BillingPlanView, BillingSummaryView } from "@/features/billing/types";

const plans: BillingPlanView[] = [
  {
    id: "weekly",
    code: "weekly",
    name: "Weekly",
    description: "Same paid access.",
    priceVersionId: "one",
    priceVersion: "launch",
    amountKobo: 700000,
    currency: "NGN",
    interval: "weekly",
    features: ["CV analysis"],
    providerConfigured: true,
  },
  {
    id: "monthly",
    code: "monthly",
    name: "Monthly",
    description: "Same paid access.",
    priceVersionId: "two",
    priceVersion: "launch",
    amountKobo: 2000000,
    currency: "NGN",
    interval: "monthly",
    badge: "Most Popular",
    features: ["CV analysis"],
    providerConfigured: true,
  },
  {
    id: "yearly",
    code: "yearly",
    name: "Yearly",
    description: "Same paid access.",
    priceVersionId: "three",
    priceVersion: "launch",
    amountKobo: 8000000,
    currency: "NGN",
    interval: "annually",
    badge: "Best Value",
    features: ["CV analysis"],
    providerConfigured: true,
  },
];

const summary: BillingSummaryView = {
  providerConfigured: true,
  currentPlan: plans[1],
  subscription: {
    status: "active",
    startedAt: "2026-09-01T00:00:00Z",
    paidThrough: "2026-10-01T00:00:00Z",
    nextPaymentAt: "2026-10-01T00:00:00Z",
    cancelAtPeriodEnd: false,
  },
  entitlement: { status: "active", startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" },
  payments: [
    {
      id: "payment",
      amountKobo: 2000000,
      currency: "NGN",
      status: "succeeded",
      paidAt: "2026-09-01T00:00:00Z",
      planName: "Monthly",
    },
  ],
  usage: [{ feature: "CV analysis", used: 2, limit: 100 }],
};

describe("Phase 12 billing experience", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows exact prices, renewal language and no-free-trial disclosure", () => {
    render(<PricingExperience fixture plans={plans} />);
    expect(screen.getByText("₦7,000")).toBeVisible();
    expect(screen.getByText("₦20,000")).toBeVisible();
    expect(screen.getByText("₦80,000")).toBeVisible();
    expect(screen.getByText("Most Popular")).toBeVisible();
    expect(screen.getByText(/Save ₦160,000/)).toBeVisible();
    expect(screen.getByText(/No free trial/)).toBeVisible();
    expect(screen.getByText(/Renews annually until cancelled/)).toBeVisible();
  });

  it("never simulates provider success when configuration is disabled", () => {
    render(
      <PricingExperience
        fixture
        plans={plans.map((plan) => ({ ...plan, providerConfigured: false }))}
        state="disabled"
      />,
    );
    expect(screen.getByText("Secure payments are not configured yet")).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose Monthly" })).toBeDisabled();
  });

  it("explains paid-through access and makes cancellation explicit", async () => {
    render(<BillingManager fixture summary={summary} />);
    expect(screen.getByText("Verified payments")).toBeVisible();
    expect(screen.getByText("2 / 100")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel renewal" }));
    await waitFor(() =>
      expect(screen.getByText(/Access continues through the paid-through date/)).toBeVisible(),
    );
  });

  it("preserves data and offers recovery after expiry", () => {
    render(<BillingManager fixture summary={summary} state="expired" />);
    expect(screen.getByText("Paid access has ended")).toBeVisible();
    expect(screen.getByText(/data is preserved/)).toBeVisible();
  });
});
