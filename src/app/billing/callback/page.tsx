import Link from "next/link";
import type { Route } from "next";
import { BillingState } from "@/features/billing/pricing-experience";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { verifyCheckoutReference } from "@/server/billing/service";

export const dynamic = "force-dynamic";

export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string; state?: string }>;
}) {
  const params = await searchParams;
  const fixture = await isTestFixtureRequest();
  let outcome: "success" | "pending" | "error" =
    params.state === "success" && fixture ? "success" : "pending";
  if (!fixture) {
    const { user } = await requireConsentedUser();
    const reference = params.reference ?? params.trxref;
    if (user?.email && reference) {
      try {
        await verifyCheckoutReference({ userId: user.id, email: user.email, reference });
        outcome = "success";
      } catch {
        outcome = "error";
      }
    }
  }
  return (
    <main className="billing-callback-page">
      <section className="billing-callback-card">
        <p className="card-eyebrow">Secure payment check</p>
        <h1>
          {outcome === "success"
            ? "Payment verified"
            : outcome === "error"
              ? "Payment is still pending"
              : "Checking your payment"}
        </h1>
        {outcome === "success" ? (
          <BillingState
            tone="success"
            title="Paid access is active"
            copy="Your entitlement came from a server-verified Paystack transaction."
          />
        ) : (
          <BillingState
            tone="amber"
            title="Access has not changed"
            copy="WAYFOUND never trusts a browser callback alone. Check billing again after server verification."
          />
        )}
        <div className="billing-actions">
          <Link className="ui-button ui-button-primary" href={"/settings/billing" as Route}>
            Open billing
          </Link>
          <Link className="ui-button ui-button-secondary" href="/dashboard">
            Return to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
