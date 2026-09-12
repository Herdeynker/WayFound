import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const productEventTypes = [
  "registration",
  "onboarding_completed",
  "first_useful_match",
  "opportunity_saved",
  "application_workspace_created",
  "application_submitted",
  "outcome_recorded",
  "alert_opened",
  "upgrade_completed",
  "ai_exported",
  "return_session",
] as const;

export type ProductEventType = (typeof productEventTypes)[number];

const allowedProperties = new Set(["channel", "pathway", "plan", "status", "source", "surface"]);

export function analyticsIdempotencyKey(eventType: ProductEventType, stableValue: string): string {
  const hex = createHash("sha256").update(`${eventType}:${stableValue}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export function sanitizeAnalyticsProperties(input: Record<string, unknown> = {}): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (allowedProperties.has(key) && typeof value === "string" && value.length <= 80) output[key] = value;
  }
  return output;
}

export async function recordProductEvent(input: {
  userId?: string | null;
  eventType: ProductEventType;
  idempotencyKey: string;
  properties?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const result = await admin.from("product_analytics_events" as never).insert({
      user_id: input.userId ?? null,
      event_type: input.eventType,
      idempotency_key: input.idempotencyKey,
      properties: sanitizeAnalyticsProperties(input.properties),
    } as never);
    return !result.error || result.error.code === "23505";
  } catch {
    // Analytics must never alter the user-facing transaction outcome.
    return false;
  }
}
