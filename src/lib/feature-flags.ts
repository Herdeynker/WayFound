import "server-only";

import { z } from "zod";

export const featureFlagNames = [
  "dashboard",
  "opportunitySearch",
  "aiDrafting",
  "payments",
  "ielts",
] as const;
export type FeatureFlagName = (typeof featureFlagNames)[number];
export type FeatureFlags = Record<FeatureFlagName, boolean>;

const defaults: FeatureFlags = {
  dashboard: false,
  opportunitySearch: false,
  aiDrafting: false,
  payments: false,
  ielts: false,
};

const parsedFlagsSchema = z.record(z.boolean());

export function getServerFeatureFlags(environmentValue = process.env.FEATURE_FLAGS_JSON): FeatureFlags {
  if (!environmentValue) return { ...defaults };
  try {
    const candidate = parsedFlagsSchema.parse(JSON.parse(environmentValue));
    return featureFlagNames.reduce<FeatureFlags>(
      (flags, name) => {
        flags[name] = candidate[name] ?? defaults[name];
        return flags;
      },
      { ...defaults },
    );
  } catch {
    return { ...defaults };
  }
}

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  return getServerFeatureFlags()[name];
}

// Nothing is client-exposed in Phase 0. Add a named, reviewed public flag here only when needed.
export const clientFeatureFlags: Readonly<Record<string, never>> = {};
