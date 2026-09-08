import "server-only";

import { parseServerEnvironment } from "@/lib/env/schema";

export const consentCategories = [
  { type: "profile_matching", label: "Use my profile to match me with opportunities.", required: true },
  {
    type: "ai_processing",
    label: "Use assisted processing to help organize and explain my information.",
    required: true,
  },
  {
    type: "document_storage",
    label: "Store documents I choose to upload in my private account.",
    required: true,
  },
  { type: "notifications", label: "Send me helpful opportunity and deadline alerts.", required: false },
] as const;

export type ConsentType = (typeof consentCategories)[number]["type"];

export function getPolicyVersion(): string {
  return parseServerEnvironment().PHASE2_POLICY_VERSION ?? "2026-09-08.v1";
}

export function getDeletionGraceDays(): number {
  return parseServerEnvironment().ACCOUNT_DELETION_GRACE_DAYS ?? 30;
}

export const requiredConsentTypes = consentCategories
  .filter((item) => item.required)
  .map((item) => item.type);
