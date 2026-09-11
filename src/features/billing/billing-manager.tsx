"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Button, Skeleton } from "@/components/ui";
import type { BillingSummaryView, BillingViewState } from "./types";
import { BillingState, formatNaira } from "./pricing-experience";

const dateLabel = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(
        new Date(value),
      )
    : "Not scheduled";

export function BillingManager({
  summary,
  state = "ready",
  fixture = false,
}: {
  summary: BillingSummaryView;
  state?: BillingViewState;
  fixture?: boolean;
}) {
  const [pending, setPending] = useState<"cancel" | "manage">();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const act = async (action: "cancel" | "manage") => {
    setPending(action);
    setNotice(undefined);
    setError(undefined);
    if (fixture) {
      setNotice(
        action === "cancel"
          ? "Renewal cancelled. Access continues through the paid-through date."
          : "Secure payment management is ready.",
      );
      setPending(undefined);
      return;
    }
    try {
      const response = await fetch(`/api/billing/subscription/${action}`, { method: "POST" });
      const body = (await response.json()) as { url?: string; error?: string; paidThrough?: string };
      if (!response.ok) throw new Error(body.error ?? "Billing could not be changed.");
      if (body.url) window.location.assign(body.url);
      else setNotice(`Renewal stopped. Access continues until ${dateLabel(body.paidThrough)}.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Billing could not be changed.");
    } finally {
      setPending(undefined);
    }
  };

  if (state === "loading")
    return (
      <div className="billing-summary-card" role="status">
        <Skeleton className="billing-plan-skeleton" />
      </div>
    );
  if (state === "permission")
    return (
      <BillingRecovery
        action="Sign in securely"
        copy="Sign in with the account that owns these billing records."
        href="/login"
        title="Billing is private"
      />
    );
  if (state === "error")
    return (
      <BillingState
        tone="error"
        title="Billing could not load"
        copy="Your subscription and access were not changed."
      />
    );
  if (state === "interrupted")
    return (
      <BillingState
        tone="amber"
        title="The billing action was interrupted"
        copy="Refresh to reconcile with Paystack before trying again."
      />
    );
  if (state === "stale")
    return (
      <BillingState
        tone="amber"
        title="This billing status may be stale"
        copy="A reconciliation is pending. Paid access follows verified server records."
      />
    );
  if (state === "expired")
    return (
      <BillingRecovery
        action="Choose a plan"
        copy="Your WAYFOUND data is preserved. Choose a plan to restore paid features."
        href="/pricing"
        title="Paid access has ended"
        tone="amber"
      />
    );
  if (state === "attention")
    return (
      <div className="billing-state-stack">
        <BillingState
          tone="amber"
          title="Payment needs attention"
          copy="Access continues only through the verified paid-through date. Update payment securely or resubscribe."
        />
        {notice ? (
          <p className="billing-inline-state" role="status">
            {notice}
          </p>
        ) : null}
        <div className="billing-actions">
          <Button loading={pending === "manage"} onClick={() => act("manage")} variant="secondary">
            Update payment
          </Button>
          <Link className="ui-button ui-button-primary" href={"/pricing" as Route}>
            Review plans
          </Link>
        </div>
      </div>
    );
  if (state === "disabled" || !summary.providerConfigured)
    return (
      <BillingState
        title="Paystack is not configured"
        copy="Billing management is unavailable and no provider action will be simulated."
      />
    );
  if (!summary.subscription || state === "empty")
    return (
      <BillingRecovery
        action="Compare plans"
        copy="You have no verified paid access. Your profile, documents and applications remain preserved."
        href="/pricing"
        title="No active subscription"
      />
    );

  const plan = summary.currentPlan;
  return (
    <div className="billing-management-grid">
      {notice ? (
        <p className="billing-inline-state" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="billing-inline-state billing-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="billing-summary-card">
        <div>
          <p className="card-eyebrow">Current subscription</p>
          <h2>{plan?.name ?? "WAYFOUND paid access"}</h2>
        </div>
        <span className="billing-status-pill">
          {state === "non_renewing" ? "Non-renewing" : summary.subscription.status.replaceAll("_", " ")}
        </span>
        <dl className="billing-detail-list">
          <div>
            <dt>Amount</dt>
            <dd>
              {plan ? formatNaira(plan.amountKobo) : "—"} /{" "}
              {plan?.interval === "annually" ? "year" : plan?.interval?.replace("ly", "")}
            </dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{dateLabel(summary.subscription.startedAt)}</dd>
          </div>
          <div>
            <dt>Paid through</dt>
            <dd>{dateLabel(summary.subscription.paidThrough)}</dd>
          </div>
          <div>
            <dt>Next renewal</dt>
            <dd>
              {summary.subscription.cancelAtPeriodEnd
                ? "Renewal stopped"
                : dateLabel(summary.subscription.nextPaymentAt)}
            </dd>
          </div>
        </dl>
        {summary.subscription.cancelAtPeriodEnd || state === "non_renewing" ? (
          <p className="billing-access-note">
            Your paid access continues until {dateLabel(summary.subscription.paidThrough)}. No further renewal
            is scheduled.
          </p>
        ) : (
          <div className="billing-actions">
            <Button loading={pending === "manage"} onClick={() => act("manage")} variant="secondary">
              Manage payment
            </Button>
            <Button loading={pending === "cancel"} onClick={() => act("cancel")} variant="quiet">
              Cancel renewal
            </Button>
          </div>
        )}
        <p className="billing-plan-change">
          To change plan, stop renewal and purchase another plan. WAYFOUND does not apply silent proration,
          credits or refunds.
        </p>
      </section>

      <section className="billing-summary-card">
        <p className="card-eyebrow">Usage this paid period</p>
        <h2>Included paid tools</h2>
        {summary.usage.length ? (
          <ul className="billing-usage-list">
            {summary.usage.map((item) => (
              <li key={item.feature}>
                <span>{item.feature}</span>
                <strong>
                  {item.used} / {item.limit ?? "Unlimited"}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>Usage will appear after you use a paid feature.</p>
        )}
      </section>

      <section className="billing-history-card">
        <div>
          <p className="card-eyebrow">Payment history</p>
          <h2>Verified payments</h2>
        </div>
        {summary.payments.length ? (
          <ul>
            {summary.payments.map((payment) => (
              <li key={payment.id}>
                <div>
                  <strong>{payment.planName}</strong>
                  <span>{dateLabel(payment.paidAt)}</span>
                </div>
                <div>
                  <strong>{formatNaira(payment.amountKobo)}</strong>
                  <span>{payment.status}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No verified payment has been recorded.</p>
        )}
      </section>
      <Link className="ui-button ui-button-secondary" href={"/pricing" as Route}>
        Compare plans
      </Link>
    </div>
  );
}

function BillingRecovery({
  action,
  copy,
  href,
  title,
  tone = "slate",
}: {
  action: string;
  copy: string;
  href: Route;
  title: string;
  tone?: "slate" | "amber" | "error" | "success";
}) {
  return (
    <div className="billing-state-stack">
      <BillingState copy={copy} title={title} tone={tone} />
      <Link className="ui-button ui-button-primary" href={href}>
        {action}
      </Link>
    </div>
  );
}
