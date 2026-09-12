import Link from "next/link";
import type { Route } from "next";
import { PricingExperience } from "@/features/billing/pricing-experience";
import type { BillingPlanView, BillingViewState } from "@/features/billing/types";
import { WayfoundLogo } from "@/components/wayfound-logo";
import { getBillingCatalog } from "@/server/billing/service";
import { isTestFixtureRequest } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

const states = new Set<BillingViewState>([
  "ready",
  "loading",
  "empty",
  "success",
  "error",
  "interrupted",
  "stale",
  "permission",
  "disabled",
]);

const fixturePlans: BillingPlanView[] = [
  {
    id: "phase12-fixture-weekly",
    code: "weekly",
    name: "Weekly",
    description: "The same core paid tools with a shorter commitment.",
    priceVersionId: "phase12-fixture-weekly-price",
    priceVersion: "launch-v1",
    amountKobo: 700_000,
    currency: "NGN",
    interval: "weekly",
    features: ["Advanced matches", "CV analysis", "AI documents", "Premium alerts"],
    providerConfigured: true,
  },
  {
    id: "phase12-fixture-monthly",
    code: "monthly",
    name: "Monthly",
    description: "The same core paid tools billed each month.",
    priceVersionId: "phase12-fixture-monthly-price",
    priceVersion: "launch-v1",
    amountKobo: 2_000_000,
    currency: "NGN",
    interval: "monthly",
    badge: "Most Popular",
    features: ["Advanced matches", "CV analysis", "AI documents", "Premium alerts"],
    providerConfigured: true,
  },
  {
    id: "phase12-fixture-yearly",
    code: "yearly",
    name: "Yearly",
    description: "The same core paid tools with the best annual value.",
    priceVersionId: "phase12-fixture-yearly-price",
    priceVersion: "launch-v1",
    amountKobo: 8_000_000,
    currency: "NGN",
    interval: "annually",
    badge: "Best Value",
    features: ["Advanced matches", "CV analysis", "AI documents", "Premium alerts"],
    providerConfigured: true,
  },
];

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const fixture = await isTestFixtureRequest();
  const requested = (await searchParams).state;
  const state =
    fixture && states.has(requested as BillingViewState) ? (requested as BillingViewState) : "ready";
  let plans: BillingPlanView[] = fixture ? fixturePlans : [];
  if (!fixture)
    try {
      plans = await getBillingCatalog();
    } catch {
      /* rendered as an honest empty/error state below */
    }
  return (
    <main className="billing-page">
      <header className="billing-topbar">
        <WayfoundLogo variant="dark" />
        <nav aria-label="Pricing navigation">
          <Link href="/dashboard">Dashboard</Link>
          <Link href={"/settings/billing" as Route}>My billing</Link>
        </nav>
      </header>
      <section className="billing-hero">
        <p className="card-eyebrow">WAYFOUND paid access</p>
        <h1>Choose the rhythm that fits your journey.</h1>
        <p>
          Every plan includes the same core paid tools. Only the billing duration, price and renewal schedule
          change.
        </p>
        <span className="billing-route-line" aria-hidden="true" />
      </section>
      <PricingExperience
        fixture={fixture}
        plans={
          fixture && state !== "disabled"
            ? plans.map((plan) => ({ ...plan, providerConfigured: true }))
            : plans
        }
        state={state}
      />
    </main>
  );
}
