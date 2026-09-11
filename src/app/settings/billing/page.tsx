import { BillingManager } from "@/features/billing/billing-manager";
import type { BillingSummaryView, BillingViewState } from "@/features/billing/types";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { getBillingSummary } from "@/server/billing/service";

const states = new Set<BillingViewState>([
  "ready",
  "loading",
  "empty",
  "error",
  "interrupted",
  "stale",
  "permission",
  "disabled",
  "expired",
  "attention",
  "non_renewing",
]);

const fixtureSummary: BillingSummaryView = {
  providerConfigured: true,
  currentPlan: {
    id: "monthly",
    code: "monthly",
    name: "Monthly",
    description: "Full WAYFOUND paid access, renewed monthly.",
    priceVersionId: "launch",
    priceVersion: "launch-2026-09",
    amountKobo: 2000000,
    currency: "NGN",
    interval: "monthly",
    badge: "Most Popular",
    features: ["Advanced matches", "CV analysis", "AI application documents", "Premium alerts"],
    providerConfigured: true,
  },
  subscription: {
    status: "active",
    startedAt: "2026-09-01T12:00:00Z",
    paidThrough: "2026-10-01T12:00:00Z",
    nextPaymentAt: "2026-10-01T12:00:00Z",
    cancelAtPeriodEnd: false,
  },
  entitlement: { status: "active", startsAt: "2026-09-01T12:00:00Z", endsAt: "2026-10-01T12:00:00Z" },
  payments: [
    {
      id: "verified-payment",
      amountKobo: 2000000,
      currency: "NGN",
      status: "succeeded",
      paidAt: "2026-09-01T12:00:00Z",
      planName: "Monthly",
    },
  ],
  usage: [
    { feature: "Advanced matches", used: 12, limit: 1000 },
    { feature: "CV analysis", used: 2, limit: 100 },
    { feature: "AI application documents", used: 3, limit: 30 },
    { feature: "Premium alerts", used: 6, limit: 1000 },
  ],
};

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const fixture = await isTestFixtureRequest();
  const requested = (await searchParams).state;
  const state =
    fixture && states.has(requested as BillingViewState) ? (requested as BillingViewState) : "ready";
  if (fixture) {
    const summary =
      state === "empty"
        ? {
            ...fixtureSummary,
            subscription: undefined,
            currentPlan: undefined,
            entitlement: undefined,
            payments: [],
            usage: [],
          }
        : state === "disabled"
          ? { ...fixtureSummary, providerConfigured: false }
          : fixtureSummary;
    return <BillingManager fixture state={state} summary={summary} />;
  }
  const { user } = await requireConsentedUser();
  if (!user) return null;
  return <BillingManager state={state} summary={await getBillingSummary(user.id)} />;
}
