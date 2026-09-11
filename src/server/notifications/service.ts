import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { ProviderDisabledError, type EmailProvider, type TelegramProvider } from "@/server/providers";
import { NotificationProviderError } from "./providers";
import {
  deriveDeepLink,
  nextDeliveryAt,
  notificationDeduplicationKey,
  notificationEventSchema,
  renderNotification,
  telegramTokenDigest,
  type NotificationChannel,
  type NotificationEventType,
  type NotificationFrequency,
} from "./model";

type AdminClient = SupabaseClient<Database, "public">;

const asMinutes = (value: string) => value.slice(0, 5);

export function createTelegramLinkSecret(): { token: string; digest: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, digest: telegramTokenDigest(token) };
}

export function telegramLinkUrl(botUsername: string, token: string): string {
  if (!/^[A-Za-z0-9_]{5,32}$/.test(botUsername)) throw new Error("Invalid Telegram bot username");
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) throw new Error("Invalid Telegram link token");
  return `https://t.me/${botUsername}?start=${encodeURIComponent(token)}`;
}

export async function hasChannelConsent(
  client: AdminClient,
  userId: string,
  channel: NotificationChannel,
): Promise<boolean> {
  const consentType = channel === "email" ? "email_notifications" : "telegram_notifications";
  const { data } = await client
    .from("user_consents")
    .select("granted,recorded_at")
    .eq("user_id", userId)
    .eq("consent_type", consentType)
    .order("recorded_at", { ascending: false })
    .limit(1);
  return data?.[0]?.granted === true;
}

async function ownsResource(client: AdminClient, userId: string, kind: string, resourceId: string) {
  if (kind === "application") {
    const { data } = await client
      .from("applications")
      .select("id")
      .eq("id", resourceId)
      .eq("user_id", userId)
      .maybeSingle();
    return Boolean(data);
  }
  const { data } = await client
    .from("match_evaluations")
    .select("id")
    .eq("opportunity_id", resourceId)
    .eq("user_id", userId)
    .limit(1);
  return Boolean(data?.length);
}

export async function enqueueNotificationEvent(
  raw: Parameters<typeof notificationEventSchema.parse>[0],
  client: AdminClient = createSupabaseAdminClient(),
): Promise<{ id: string; duplicate: boolean }> {
  const input = notificationEventSchema.parse(raw);
  if (!(await ownsResource(client, input.userId, input.resourceKind, input.resourceId))) {
    throw new Error("Notification resource is unavailable");
  }
  const deduplicationKey = notificationDeduplicationKey(input);
  const deepLink = deriveDeepLink(input.resourceKind, input.resourceId);
  const existing = await client
    .from("notification_events")
    .select("id")
    .eq("user_id", input.userId)
    .eq("deduplication_key", deduplicationKey)
    .maybeSingle();
  if (existing.data) return { id: existing.data.id, duplicate: true };

  const event = await client
    .from("notification_events")
    .insert({
      user_id: input.userId,
      event_type: input.eventType,
      resource_kind: input.resourceKind,
      resource_id: input.resourceId,
      deduplication_key: deduplicationKey,
      deep_link: deepLink,
      safe_context: input.safeContext,
      occurred_at: input.occurredAt.toISOString(),
    })
    .select("id")
    .single();
  if (event.error) {
    const replay = await client
      .from("notification_events")
      .select("id")
      .eq("user_id", input.userId)
      .eq("deduplication_key", deduplicationKey)
      .single();
    if (replay.data) return { id: replay.data.id, duplicate: true };
    throw new Error("Notification event could not be queued");
  }

  const preference = await client
    .from("notification_preferences")
    .select(
      "email_frequency,telegram_frequency,timezone_name,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,event_types",
    )
    .eq("user_id", input.userId)
    .single();
  if (!preference.data || !preference.data.event_types.includes(input.eventType))
    return { id: event.data.id, duplicate: false };

  const deliveries: Database["public"]["Tables"]["notification_deliveries"]["Insert"][] = [];
  for (const channel of ["email", "telegram"] as const) {
    const frequency =
      channel === "email" ? preference.data.email_frequency : preference.data.telegram_frequency;
    const consented = await hasChannelConsent(client, input.userId, channel);
    const availableAt = consented
      ? nextDeliveryAt({
          now: input.occurredAt,
          frequency: frequency as NotificationFrequency,
          eventType: input.eventType,
          timeZone: preference.data.timezone_name,
          quietHoursEnabled: preference.data.quiet_hours_enabled,
          quietStart: asMinutes(preference.data.quiet_hours_start),
          quietEnd: asMinutes(preference.data.quiet_hours_end),
        })
      : null;
    if (availableAt) {
      deliveries.push({
        event_id: event.data.id,
        user_id: input.userId,
        channel,
        status: availableAt > input.occurredAt ? "scheduled" : "queued",
        available_at: availableAt.toISOString(),
      });
    }
  }
  if (deliveries.length) {
    const { error } = await client.from("notification_deliveries").insert(deliveries);
    if (error) throw new Error("Notification delivery could not be scheduled");
  }
  return { id: event.data.id, duplicate: false };
}

type ClaimedDelivery = Database["public"]["Tables"]["notification_deliveries"]["Row"] & {
  notification_events: Pick<
    Database["public"]["Tables"]["notification_events"]["Row"],
    "event_type" | "deep_link" | "occurred_at"
  >;
};

function retryDelay(attempt: number): number {
  return Math.min(60, 2 ** Math.max(0, attempt - 1) * 5) * 60_000;
}

function safeFailure(error: unknown): { code: string; retryable: boolean } {
  if (error instanceof ProviderDisabledError) return { code: "provider_disabled", retryable: false };
  if (error instanceof NotificationProviderError) {
    return {
      code:
        error.code === "PROVIDER_TIMEOUT"
          ? "provider_timeout"
          : error.code === "PROVIDER_TEMPORARY"
            ? "provider_temporary"
            : "provider_permanent",
      retryable: error.retryable,
    };
  }
  return { code: "provider_temporary", retryable: true };
}

async function resolveDestination(client: AdminClient, delivery: ClaimedDelivery): Promise<string | null> {
  if (delivery.channel === "telegram") {
    const link = await client
      .from("telegram_links")
      .select("chat_id")
      .eq("user_id", delivery.user_id)
      .eq("status", "active")
      .maybeSingle();
    return link.data?.chat_id ?? null;
  }
  const user = await client.auth.admin.getUserById(delivery.user_id);
  return user.data.user?.email_confirmed_at ? (user.data.user.email ?? null) : null;
}

async function finishDelivery(input: {
  client: AdminClient;
  delivery: ClaimedDelivery;
  workerToken: string;
  outcome: "sent" | "retry" | "suppressed" | "permanent_failure";
  providerRequestId?: string;
  failureCode?: string;
}) {
  const terminal =
    input.outcome === "sent" || input.outcome === "suppressed" || input.outcome === "permanent_failure";
  const update = await input.client
    .from("notification_deliveries")
    .update({
      status: input.outcome,
      provider_message_id: input.providerRequestId ?? null,
      failure_code: input.failureCode ?? null,
      delivered_at: input.outcome === "sent" ? new Date().toISOString() : null,
      available_at:
        input.outcome === "retry"
          ? new Date(Date.now() + retryDelay(input.delivery.attempt_count)).toISOString()
          : input.delivery.available_at,
      lease_token: null,
      lease_expires_at: null,
    })
    .eq("id", input.delivery.id)
    .eq("lease_token", input.workerToken);
  if (update.error) throw new Error("Notification delivery finalization failed");
  const attempt = await input.client.from("notification_delivery_attempts").insert({
    delivery_id: input.delivery.id,
    user_id: input.delivery.user_id,
    attempt_number: input.delivery.attempt_count,
    outcome: input.outcome,
    provider_request_id: input.providerRequestId ?? null,
    failure_code: input.failureCode ?? null,
  });
  if (attempt.error && !terminal) throw new Error("Notification retry could not be recorded");
}

export async function runNotificationBatch(input: {
  appUrl: string;
  email: EmailProvider;
  telegram: TelegramProvider;
  client?: AdminClient;
  limit?: number;
}): Promise<{ claimed: number; sent: number; retried: number; suppressed: number; failed: number }> {
  const client = input.client ?? createSupabaseAdminClient();
  const workerToken = randomUUID();
  const claimed = await client.rpc("phase11_claim_notification_deliveries", {
    worker_token: workerToken,
    batch_limit: Math.min(50, Math.max(1, input.limit ?? 25)),
    lease_seconds: 120,
  });
  if (claimed.error) throw new Error("Notification batch could not be claimed");
  const ids = (claimed.data ?? []) as string[];
  if (!ids.length) return { claimed: 0, sent: 0, retried: 0, suppressed: 0, failed: 0 };
  const rows = await client
    .from("notification_deliveries")
    .select("*,notification_events(event_type,deep_link,occurred_at)")
    .in("id", ids)
    .eq("lease_token", workerToken);
  if (rows.error) throw new Error("Claimed notifications could not be loaded");
  const result = { claimed: ids.length, sent: 0, retried: 0, suppressed: 0, failed: 0 };
  for (const delivery of (rows.data ?? []) as unknown as ClaimedDelivery[]) {
    const destination = await resolveDestination(client, delivery);
    const suppression = await client
      .from("notification_suppressions")
      .select("id")
      .eq("user_id", delivery.user_id)
      .eq("channel", delivery.channel)
      .eq("active", true)
      .maybeSingle();
    if (!destination || suppression.data) {
      await finishDelivery({
        client,
        delivery,
        workerToken,
        outcome: "suppressed",
        failureCode: suppression.data
          ? "unsubscribed"
          : delivery.channel === "email"
            ? "email_unverified"
            : "telegram_unlinked",
      });
      result.suppressed += 1;
      continue;
    }
    try {
      const message = renderNotification({
        eventType: delivery.notification_events.event_type as NotificationEventType,
        deepLink: delivery.notification_events.deep_link,
        appUrl: input.appUrl,
      });
      const receipt =
        delivery.channel === "email"
          ? await input.email.send({ to: destination, subject: message.subject, text: message.text })
          : await input.telegram.sendMessage(destination, `${message.subject}\n\n${message.text}`);
      await finishDelivery({
        client,
        delivery,
        workerToken,
        outcome: "sent",
        providerRequestId: receipt.requestId,
      });
      result.sent += 1;
    } catch (error) {
      const failure = safeFailure(error);
      const retryable = failure.retryable && delivery.attempt_count < 5;
      await finishDelivery({
        client,
        delivery,
        workerToken,
        outcome: retryable ? "retry" : "permanent_failure",
        failureCode: failure.code,
      });
      if (retryable) result.retried += 1;
      else result.failed += 1;
    }
  }
  return result;
}

export function verifiedEmail(user: User): boolean {
  return Boolean(user.email && user.email_confirmed_at);
}
