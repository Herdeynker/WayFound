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

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const fixture = await isTestFixtureRequest();
  const requested = (await searchParams).state;
  const state =
    fixture && states.has(requested as BillingViewState) ? (requested as BillingViewState) : "ready";
  let plans: BillingPlanView[] = [];
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
