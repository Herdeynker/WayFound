"use client";

import React from "react";
import Link from "next/link";
import { Card, Skeleton } from "@/components/ui";

export type TrustCenterState =
  | "ready"
  | "first-use"
  | "success"
  | "loading"
  | "error"
  | "interrupted"
  | "stale"
  | "permission"
  | "provider-disabled";

const stateCopy: Record<
  Exclude<TrustCenterState, "ready" | "loading">,
  { title: string; body: string; tone: string }
> = {
  "first-use": {
    title: "Start with your privacy choices",
    body: "Review how matching, documents and optional alerts work before you add personal information.",
    tone: "info",
  },
  success: {
    title: "Your choices are saved",
    body: "Your latest consent record is active. Earlier decisions remain in the versioned history below.",
    tone: "success",
  },
  error: {
    title: "Privacy status could not be loaded",
    body: "Nothing was changed. Refresh this page before making another privacy or account request.",
    tone: "danger",
  },
  interrupted: {
    title: "The operation was interrupted",
    body: "No completion was recorded. Check your connection and retry when you are ready.",
    tone: "warning",
  },
  stale: {
    title: "This status may be out of date",
    body: "Refresh before relying on this information or changing an important account setting.",
    tone: "warning",
  },
  permission: {
    title: "Permission required",
    body: "Only the account owner can view consent history or request an export or deletion.",
    tone: "danger",
  },
  "provider-disabled": {
    title: "Document scanning is unavailable",
    body: "Uploads remain blocked and are not promoted to your private library until the safety scanner is configured.",
    tone: "warning",
  },
};

export function TrustCenter({
  state = "ready",
  policyVersion,
  scannerConfigured,
  children,
}: {
  state?: TrustCenterState;
  policyVersion: string;
  scannerConfigured: boolean;
  children?: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (state === "loading")
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading your privacy controls"
        data-phase14-hydrated={mounted}
      >
        <Card className="trust-center" as="div">
          <p className="card-eyebrow">Trust center</p>
          <h2>Loading your privacy controls</h2>
          <Skeleton className="trust-skeleton-wide" />
          <Skeleton className="trust-skeleton-short" />
        </Card>
      </div>
    );
  const notice = state === "ready" ? null : stateCopy[state];
  return (
    <div className="trust-center-stack" data-phase14-hydrated={mounted}>
      <Card className="trust-center trust-hero" as="div">
        <div>
          <p className="card-eyebrow">Paid-beta trust center</p>
          <h2>Your information stays under your control</h2>
          <p>
            WAYFOUND uses the details you confirm to explain opportunities and help prepare applications. It
            does not guarantee eligibility, sponsorship, admission, employment or visa outcomes.
          </p>
        </div>
        <span className="trust-shield" aria-hidden="true">
          ✓
        </span>
      </Card>

      {notice ? (
        <div
          className={`trust-notice trust-notice-${notice.tone}`}
          role={state === "error" ? "alert" : "status"}
        >
          <strong>{notice.title}</strong>
          <span>{notice.body}</span>
          {state === "error" || state === "interrupted" || state === "stale" ? (
            <button type="button" onClick={() => window.location.reload()}>
              Retry securely
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="trust-grid">
        <Card className="trust-panel" as="article">
          <span className="trust-step">01</span>
          <h3>Private by default</h3>
          <p>Passport, application and practice records are owner-isolated. Signed file links expire.</p>
          <strong>Row-level access enforced</strong>
        </Card>
        <Card className="trust-panel" as="article">
          <span className="trust-step">02</span>
          <h3>Uploads are quarantined</h3>
          <p>Files are held outside your library until validation and malware scanning complete.</p>
          <strong>
            {scannerConfigured ? "Scanner configured" : "Uploads blocked until scanner is ready"}
          </strong>
        </Card>
        <Card className="trust-panel" as="article">
          <span className="trust-step">03</span>
          <h3>External actions stay yours</h3>
          <p>WAYFOUND can prepare drafts, but you review, export and submit them yourself.</p>
          <strong>No automatic applications</strong>
        </Card>
        <Card className="trust-panel" as="article">
          <span className="trust-step">04</span>
          <h3>Paid access is verified</h3>
          <p>
            Provider callbacks never grant access alone; entitlements change only after server verification.
          </p>
          <strong>No unverified success state</strong>
        </Card>
      </div>

      <Card className="trust-policy-card" as="section">
        <div>
          <p className="card-eyebrow">Policy {policyVersion}</p>
          <h3>Plain-language policies and retention</h3>
          <p>Review the terms, privacy notice, product disclaimer and data-retention schedule.</p>
        </div>
        <Link className="ui-button ui-button-secondary" href="/legal">
          Read policies →
        </Link>
      </Card>
      {children}
    </div>
  );
}
