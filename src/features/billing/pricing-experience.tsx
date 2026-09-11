"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { BillingPlanView, BillingViewState } from "./types";
import { Button, Skeleton } from "@/components/ui";

const intervalLabel = { weekly: "week", monthly: "month", annually: "year" } as const;
const renewalLabel = { weekly: "weekly", monthly: "monthly", annually: "annually" } as const;

export function formatNaira(amountKobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amountKobo / 100);
}

export function PricingExperience({
  plans,
  state = "ready",
  fixture = false,
}: {
  plans: BillingPlanView[];
  state?: BillingViewState;
  fixture?: boolean;
}) {
  const [pending, setPending] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const checkout = async (plan: BillingPlanView) => {
    setPending(plan.code);
    setError(undefined);
    setMessage(undefined);
    if (fixture) {
      setMessage(`Secure ${plan.name} checkout is ready. No fixture charge was attempted.`);
      setPending(undefined);
      return;
    }
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.code, idempotencyKey: crypto.randomUUID() }),
      });
      const body = (await response.json()) as { authorizationUrl?: string; error?: string };
      if (!response.ok || !body.authorizationUrl) throw new Error(body.error ?? "Checkout could not start.");
      window.location.assign(body.authorizationUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not start.");
      setPending(undefined);
    }
  };

  if (state === "loading")
    return (
      <div className="billing-plan-grid" aria-label="Loading plans" role="status">
        {[1, 2, 3].map((item) => (
          <div className="billing-plan-card" key={item}>
            <Skeleton className="billing-plan-skeleton" />
          </div>
        ))}
      </div>
    );
  if (state === "permission")
    return (
      <BillingState
        title="Sign in to manage payment"
        copy="Prices are visible, but checkout and billing records require your authenticated account."
      />
    );
  if (state === "error")
    return (
      <BillingState
        tone="error"
        title="Pricing could not load"
        copy="No charge was attempted. Refresh when your connection is stable."
      />
    );
  if (state === "interrupted")
    return (
      <BillingState
        tone="amber"
        title="Checkout was interrupted"
        copy="Access was not activated and no payment is assumed. You can safely start again."
      />
    );
  if (state === "stale")
    return (
      <BillingState
        tone="amber"
        title="Your billing view is out of date"
        copy="Refresh before selecting a plan so the server can confirm the current price."
      />
    );
  if (!plans.length || state === "empty")
    return (
      <BillingState
        title="No paid plans are available"
        copy="Payment cannot be started until a server-approved price version is active."
      />
    );

  const disabled = state === "disabled" || plans.every((plan) => !plan.providerConfigured);
  return (
    <>
      {disabled ? (
        <BillingState
          title="Secure payments are not configured yet"
          copy="Plan prices are shown for transparency, but checkout is disabled and no charge can be attempted."
        />
      ) : null}
      {state === "success" ? (
        <BillingState
          tone="success"
          title="Payment verified"
          copy="Your paid access is active. Billing details remain available in Settings."
        />
      ) : null}
      {message ? (
        <p className="billing-inline-state" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="billing-inline-state billing-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="billing-plan-grid">
        {plans.map((plan) => (
          <article
            className={`billing-plan-card ${plan.code === "monthly" ? "is-popular" : ""}`}
            key={plan.id}
          >
            <div className="billing-plan-heading">
              <div>
                <p className="card-eyebrow">
                  {plan.code === "weekly"
                    ? "Flexible access"
                    : plan.code === "monthly"
                      ? "Monthly access"
                      : "Annual access"}
                </p>
                <h2>{plan.name}</h2>
              </div>
              {plan.badge ? <span className="billing-plan-badge">{plan.badge}</span> : null}
            </div>
            <p className="billing-price">
              <strong>{formatNaira(plan.amountKobo)}</strong>
              <span>per {intervalLabel[plan.interval]}</span>
            </p>
            {plan.code === "yearly" ? (
              <p className="billing-saving">
                Approximately ₦6,667/month. Save ₦160,000 compared with paying ₦20,000 monthly for 12 months.
              </p>
            ) : null}
            <p>{plan.description}</p>
            <ul className="billing-feature-list">
              {plan.features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
            <p className="billing-renewal">
              <strong>Paid immediately.</strong> Renews {renewalLabel[plan.interval]} until cancelled.
            </p>
            <Button
              disabled={disabled}
              loading={pending === plan.code}
              onClick={() => checkout(plan)}
              type="button"
              variant={plan.code === "monthly" ? "primary" : "secondary"}
            >
              Choose {plan.name}
            </Button>
          </article>
        ))}
      </div>
      <div className="billing-terms-card">
        <h2>Clear billing, no trial</h2>
        <p>No free trial. Each plan is a recurring subscription charged immediately in Nigerian naira.</p>
        <p>
          Cancel renewal before the next billing date. Existing verified paid access continues until its
          paid-through date unless a refund, reversal or fraud decision revokes it.
        </p>
        <p>
          Payments are processed securely by Paystack. WAYFOUND never guarantees eligibility, scholarships,
          jobs, sponsorship, visas or relocation outcomes.
        </p>
        <Link href={"/settings/billing" as Route}>View billing and payment history</Link>
      </div>
    </>
  );
}

export function BillingState({
  title,
  copy,
  tone = "slate",
}: {
  title: string;
  copy: string;
  tone?: "slate" | "amber" | "error" | "success";
}) {
  return (
    <div className={`billing-state billing-state-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}
