import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";
import { getPolicyVersion, requiredConsentTypes, type ConsentType } from "./constants";

type AuthClient = SupabaseClient<Database, "public">;

export async function getCurrentUser(client: AuthClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function hasCurrentRequiredConsent(client: AuthClient, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from("user_consents")
    .select("consent_type, granted")
    .eq("user_id", userId)
    .eq("policy_version", getPolicyVersion())
    .eq("granted", true);
  if (error) return false;
  const granted = new Set((data ?? []).map((item) => item.consent_type));
  return requiredConsentTypes.every((type) => granted.has(type));
}

export async function bootstrapAccount(client: AuthClient, user: User): Promise<void> {
  const firstName =
    typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name.trim() : "";
  const displayName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : firstName;
  await client
    .from("profiles")
    .upsert({ id: user.id, first_name: firstName, display_name: displayName }, { onConflict: "id" });
  await client.from("notification_preferences").upsert({ user_id: user.id }, { onConflict: "user_id" });
}

export async function recordAudit(
  client: AuthClient,
  userId: string | null,
  eventType: Database["public"]["Tables"]["audit_events"]["Insert"]["event_type"],
  metadata: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  await client.from("audit_events").insert({ user_id: userId, event_type: eventType, metadata });
}

export async function recordConsent(
  client: AuthClient,
  userId: string,
  consents: Partial<Record<ConsentType, boolean>>,
): Promise<{ error: string | null }> {
  const rows = Object.entries(consents).map(([consentType, granted]) => ({
    user_id: userId,
    policy_version: getPolicyVersion(),
    consent_type: consentType,
    granted: Boolean(granted),
    required: requiredConsentTypes.includes(consentType as (typeof requiredConsentTypes)[number]),
    source: "web",
  }));
  const { error } = await client.from("user_consents").insert(rows);
  if (error) return { error: "We could not save your choices. Please try again." };
  await recordAudit(client, userId, "consent_recorded", { policy_version: getPolicyVersion() });
  return { error: null };
}
