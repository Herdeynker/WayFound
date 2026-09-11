import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/supabase/database.types";
import { enqueueNotificationEvent, runNotificationBatch } from "@/server/notifications/service";

loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(url && publicKey && secretKey);
const testCase = live ? it : it.skip;
const admin = live
  ? createClient<Database>(url!, secretKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const users: string[] = [];

function userClient(storageKey: string) {
  return createClient<Database>(url!, publicKey!, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey },
  });
}

describe("Phase 11 hosted notification security and delivery", () => {
  afterAll(async () => {
    if (!admin) return;
    for (const userId of users) expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
  }, 45_000);

  testCase(
    "enforces linking, consent, outbox deduplication, retries, suppression and owner isolation",
    async () => {
      const password = `Phase11-${crypto.randomUUID()}-Safe!`;
      const [createdA, createdB] = await Promise.all(
        ["a", "b"].map((suffix) =>
          admin!.auth.admin.createUser({
            email: `phase11-${suffix}-${crypto.randomUUID()}@example.test`,
            password,
            email_confirm: true,
          }),
        ),
      );
      expect(createdA.error).toBeNull();
      expect(createdB.error).toBeNull();
      const userA = createdA.data.user!.id;
      const userB = createdB.data.user!.id;
      users.push(userA, userB);
      const clientA = userClient(`phase11-a-${crypto.randomUUID()}`);
      const clientB = userClient(`phase11-b-${crypto.randomUUID()}`);
      const anonymous = userClient(`phase11-anon-${crypto.randomUUID()}`);
      expect(
        (await clientA.auth.signInWithPassword({ email: createdA.data.user!.email!, password })).error,
      ).toBeNull();
      expect(
        (await clientB.auth.signInWithPassword({ email: createdB.data.user!.email!, password })).error,
      ).toBeNull();

      expect(
        (
          await clientA.from("user_consents").insert([
            {
              user_id: userA,
              policy_version: "2026-09-08.v1",
              consent_type: "email_notifications",
              granted: true,
            },
            {
              user_id: userA,
              policy_version: "2026-09-08.v1",
              consent_type: "telegram_notifications",
              granted: true,
            },
          ])
        ).error,
      ).toBeNull();

      const token = crypto.randomUUID().replaceAll("-", "").padEnd(64, "a");
      expect(
        (await clientA.rpc("phase11_create_telegram_link_token", { token_digest: token })).error,
      ).toBeNull();
      expect((await clientA.from("telegram_link_tokens").select("id")).error).not.toBeNull();
      expect((await clientB.from("telegram_link_tokens").select("id")).error).not.toBeNull();
      expect(
        (
          await admin!.rpc("phase11_consume_telegram_link_token", {
            token_digest: "f".repeat(64),
            candidate_chat_id: "invalid-chat",
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await admin!.rpc("phase11_consume_telegram_link_token", {
            token_digest: token,
            candidate_chat_id: `phase11-${crypto.randomUUID()}`,
            candidate_display_label: "Synthetic user",
          })
        ).error,
      ).toBeNull();
      expect((await clientA.from("telegram_links").select("id,status")).data).toHaveLength(1);
      expect((await clientB.from("telegram_links").select("id,status")).data).toHaveLength(0);
      expect(
        (
          await clientA.from("telegram_links").insert({
            user_id: userB,
            chat_id: "forged-chat",
          })
        ).error,
      ).not.toBeNull();

      const saved = await clientA.rpc("phase11_save_notification_preferences", {
        candidate_email_frequency: "instant",
        candidate_telegram_frequency: "instant",
        candidate_timezone_name: "Africa/Lagos",
        candidate_quiet_hours_enabled: false,
        candidate_quiet_hours_start: "22:00",
        candidate_quiet_hours_end: "07:00",
        candidate_event_types: ["deadline"],
        email_consent: true,
        telegram_consent: true,
        candidate_policy_version: "2026-09-08.v1",
      });
      expect(saved.error).toBeNull();

      const opportunity = await admin!.from("opportunities").select("id").limit(1).single();
      const application = await admin!
        .from("applications")
        .insert({ user_id: userA, opportunity_id: opportunity.data!.id })
        .select("id")
        .single();
      expect(application.error).toBeNull();
      const input = {
        userId: userA,
        eventType: "deadline" as const,
        resourceKind: "application" as const,
        resourceId: application.data!.id,
        occurrenceKey: "deadline:phase11:seven-days",
        occurredAt: new Date(Date.now() - 60_000),
        safeContext: { days_remaining: 7, urgency: "soon" as const },
      };
      const first = await enqueueNotificationEvent(input, admin!);
      const duplicate = await enqueueNotificationEvent({ ...input, occurredAt: new Date() }, admin!);
      expect(duplicate).toEqual({ id: first.id, duplicate: true });
      expect(
        (
          await admin!.from("notification_events").insert({
            user_id: userA,
            event_type: "deadline",
            resource_kind: "application",
            resource_id: application.data!.id,
            deduplication_key: "d".repeat(64),
            deep_link: "https://evil.example/steal",
            safe_context: { private_document: "must fail" },
            occurred_at: new Date().toISOString(),
          })
        ).error,
      ).not.toBeNull();

      expect((await anonymous.from("notification_events").select("id")).error).not.toBeNull();
      expect((await clientA.from("notification_events").select("id").eq("id", first.id)).data).toHaveLength(
        1,
      );
      expect((await clientB.from("notification_events").select("id").eq("id", first.id)).data).toHaveLength(
        0,
      );
      expect(
        (
          await clientA.from("notification_events").insert({
            user_id: userA,
            event_type: "deadline",
            resource_kind: "application",
            resource_id: application.data!.id,
            deduplication_key: "e".repeat(64),
            deep_link: `/applications/${application.data!.id}`,
            occurred_at: new Date().toISOString(),
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await clientA.rpc("phase11_claim_notification_deliveries", {
            worker_token: crypto.randomUUID(),
            batch_limit: 10,
            lease_seconds: 120,
          })
        ).error,
      ).not.toBeNull();

      let telegramAttempts = 0;
      const firstBatch = await runNotificationBatch({
        client: admin!,
        appUrl: "https://app.wayfound.example",
        email: { send: async () => ({ provider: "email", operation: "send", requestId: "email-1" }) },
        telegram: {
          sendMessage: async () => {
            telegramAttempts += 1;
            throw new Error("synthetic temporary failure");
          },
        },
      });
      expect(firstBatch).toMatchObject({ claimed: 2, sent: 1, retried: 1, failed: 0 });
      expect(telegramAttempts).toBe(1);
      const retry = await admin!
        .from("notification_deliveries")
        .select("id")
        .eq("event_id", first.id)
        .eq("channel", "telegram")
        .single();
      await admin!
        .from("notification_deliveries")
        .update({ available_at: new Date(Date.now() - 1_000).toISOString() })
        .eq("id", retry.data!.id);
      const recovered = await runNotificationBatch({
        client: admin!,
        appUrl: "https://app.wayfound.example",
        email: { send: async () => ({ provider: "email", operation: "send", requestId: "unused" }) },
        telegram: {
          sendMessage: async () => ({
            provider: "telegram",
            operation: "sendMessage",
            requestId: "telegram-2",
          }),
        },
      });
      expect(recovered).toMatchObject({ claimed: 1, sent: 1, retried: 0 });
      expect((await clientA.from("notification_delivery_attempts").select("id")).data).toHaveLength(3);
      expect((await clientB.from("notification_delivery_attempts").select("id")).data).toHaveLength(0);

      expect((await clientA.rpc("phase11_unlink_telegram")).error).toBeNull();
      const afterUnlink = await clientA
        .from("notification_preferences")
        .select("telegram_frequency,telegram_enabled")
        .single();
      expect(afterUnlink.data).toMatchObject({ telegram_frequency: "off", telegram_enabled: false });
      expect(
        (await clientA.rpc("phase11_unsubscribe_email", { candidate_policy_version: "2026-09-08.v1" })).error,
      ).toBeNull();
      expect((await clientA.from("notification_suppressions").select("reason")).data).toEqual([
        { reason: "user_unsubscribed" },
      ]);

      const expiring = "c".repeat(64);
      expect(
        (await clientA.rpc("phase11_create_telegram_link_token", { token_digest: expiring })).error,
      ).toBeNull();
      const expiredAt = new Date(Date.now() - 60_000);
      const createdAt = new Date(expiredAt.getTime() - 10 * 60_000);
      expect(
        (
          await admin!
            .from("telegram_link_tokens")
            .update({ created_at: createdAt.toISOString(), expires_at: expiredAt.toISOString() })
            .eq("token_hash", expiring)
        ).error,
      ).toBeNull();
      expect(
        (
          await admin!.rpc("phase11_consume_telegram_link_token", {
            token_digest: expiring,
            candidate_chat_id: "expired-chat",
          })
        ).error,
      ).not.toBeNull();
    },
    60_000,
  );
});
