export const billingPlanCodes = ["weekly", "monthly", "yearly"] as const;
export type BillingPlanCode = (typeof billingPlanCodes)[number];

export const billingIntervals = ["weekly", "monthly", "annually"] as const;
export type BillingInterval = (typeof billingIntervals)[number];

export const billingFeatureCodes = [
  "advanced_matches",
  "cv_analysis",
  "ai_documents",
  "premium_alerts",
] as const;
export type BillingFeatureCode = (typeof billingFeatureCodes)[number];

export interface BillingPlanView {
  id: string;
  code: BillingPlanCode;
  name: string;
  description: string;
  priceVersionId: string;
  priceVersion: string;
  amountKobo: number;
  currency: "NGN";
  interval: BillingInterval;
  badge?: "Most Popular" | "Best Value";
  features: string[];
  providerConfigured: boolean;
}

export type BillingViewState =
  | "ready"
  | "loading"
  | "empty"
  | "success"
  | "error"
  | "interrupted"
  | "stale"
  | "permission"
  | "disabled"
  | "expired"
  | "attention"
  | "non_renewing";

export interface BillingSummaryView {
  providerConfigured: boolean;
  currentPlan?: BillingPlanView;
  subscription?: {
    status: string;
    startedAt?: string;
    paidThrough?: string;
    nextPaymentAt?: string;
    cancelAtPeriodEnd: boolean;
  };
  entitlement?: { status: string; startsAt: string; endsAt: string };
  payments: Array<{
    id: string;
    amountKobo: number;
    currency: string;
    status: string;
    paidAt?: string;
    planName: string;
  }>;
  usage: Array<{ feature: string; used: number; limit: number | null }>;
}
