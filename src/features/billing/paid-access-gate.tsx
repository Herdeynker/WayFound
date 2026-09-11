import Link from "next/link";
import type { Route } from "next";

export function PaidAccessGate({ title = "A paid plan is required" }: { title?: string }) {
  return (
    <main className="paid-access-page">
      <section className="paid-access-card">
        <p className="card-eyebrow">WAYFOUND paid access</p>
        <h1>{title}</h1>
        <p>
          Your profile, applications and documents remain safe. Choose Weekly, Monthly or Yearly to use this
          paid tool. There is no free trial and access begins only after payment is verified.
        </p>
        <div className="billing-actions">
          <Link className="ui-button ui-button-primary" href={"/pricing" as Route}>
            Compare plans
          </Link>
          <Link className="ui-button ui-button-secondary" href={"/settings/billing" as Route}>
            View billing
          </Link>
        </div>
      </section>
    </main>
  );
}
