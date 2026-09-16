import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/supabase/database.types";

loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(url && publicKey && secretKey);
const hostedCase = live ? it : it.skip;
const admin = live
  ? createClient<Database>(url!, secretKey!, {
      auth: { autoRefreshToken: false, persistSession: false, storageKey: "phase16-admin" },
    })
  : null;
const createdUsers: string[] = [];

function userClient(storageKey: string) {
  return createClient<Database>(url!, publicKey!, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey },
  });
}

async function clearPriorFixtures() {
  if (!admin) return;
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  expect(users.error).toBeNull();
  for (const user of users.data.users.filter((item) =>
    /^phase16-[ab]-.*@example\.test$/.test(item.email ?? ""),
  )) {
    expect((await admin.auth.admin.deleteUser(user.id)).error).toBeNull();
  }
}

describe("Phase 16 personalized discovery ownership and safe-data boundaries", () => {
  beforeAll(clearPriorFixtures, 30_000);
  afterAll(async () => {
    if (!admin) return;
    for (const userId of createdUsers) {
      expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
    }
  }, 30_000);

  hostedCase(
    "isolates walkthrough, checklist and saved opportunity state while exposing only safe opportunities",
    async () => {
      const password = `Phase16-${crypto.randomUUID()}-Safe!`;
      const createdA = await admin!.auth.admin.createUser({
        email: `phase16-a-${crypto.randomUUID()}@example.test`,
        password,
        email_confirm: true,
      });
      const createdB = await admin!.auth.admin.createUser({
        email: `phase16-b-${crypto.randomUUID()}@example.test`,
        password,
        email_confirm: true,
      });
      expect(createdA.error).toBeNull();
      expect(createdB.error).toBeNull();
      const userA = createdA.data.user!.id;
      const userB = createdB.data.user!.id;
      createdUsers.push(userA, userB);

      const clientA = userClient(`phase16-a-${crypto.randomUUID()}`);
      const clientB = userClient(`phase16-b-${crypto.randomUUID()}`);
      const anonymous = userClient(`phase16-anon-${crypto.randomUUID()}`);
      expect(
        (await clientA.auth.signInWithPassword({ email: createdA.data.user!.email!, password })).error,
      ).toBeNull();
      expect(
        (await clientB.auth.signInWithPassword({ email: createdB.data.user!.email!, password })).error,
      ).toBeNull();

      const safe = await admin!.from("safe_active_opportunities").select("id").limit(1).single();
      expect(safe.error).toBeNull();
      const opportunityId = safe.data!.id!;

      expect(
        (
          await clientA.from("user_walkthrough_state").upsert({
            user_id: userA,
            version: "v1",
            completed_at: new Date().toISOString(),
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await clientA
            .from("user_checklist_state")
            .upsert({ user_id: userA, collapsed_at: new Date().toISOString() })
        ).error,
      ).toBeNull();
      expect(
        (
          await clientA.from("opportunity_user_states").upsert({
            user_id: userA,
            opportunity_id: opportunityId,
            state: "saved",
          })
        ).error,
      ).toBeNull();

      expect((await clientA.from("user_walkthrough_state").select("user_id")).data).toHaveLength(1);
      expect((await clientB.from("user_walkthrough_state").select("user_id")).data).toHaveLength(0);
      expect((await clientA.from("user_checklist_state").select("user_id")).data).toHaveLength(1);
      expect((await clientB.from("user_checklist_state").select("user_id")).data).toHaveLength(0);
      expect((await clientA.from("opportunity_user_states").select("user_id")).data).toHaveLength(1);
      expect((await clientB.from("opportunity_user_states").select("user_id")).data).toHaveLength(0);

      expect(
        (await clientA.from("user_walkthrough_state").insert({ user_id: userB, version: "v1" })).error,
      ).not.toBeNull();
      expect((await clientA.from("user_checklist_state").insert({ user_id: userB })).error).not.toBeNull();
      expect(
        (
          await clientA.from("opportunity_user_states").insert({
            user_id: userB,
            opportunity_id: opportunityId,
            state: "dismissed",
          })
        ).error,
      ).not.toBeNull();
      expect(
        (await clientA.from("user_walkthrough_state").update({ user_id: userB }).eq("user_id", userA)).error,
      ).not.toBeNull();

      expect((await anonymous.from("user_walkthrough_state").select("user_id")).error).not.toBeNull();
      expect((await anonymous.from("user_checklist_state").select("user_id")).error).not.toBeNull();
      expect((await anonymous.from("opportunity_user_states").select("user_id")).error).not.toBeNull();
      expect((await anonymous.from("destination_media").select("id")).error).not.toBeNull();
      expect((await clientA.from("destination_media").select("id")).error).not.toBeNull();

      const media = await admin!.from("destination_media").select("asset_path,licence");
      expect(media.error).toBeNull();
      expect(media.data!.length).toBeGreaterThanOrEqual(4);
      expect(
        media.data!.every((item) => item.asset_path.startsWith("/images/") && item.licence.length > 1),
      ).toBe(true);
      expect(media.data).toContainEqual({
        asset_path: "/images/destinations/amsterdam-skyline.jpg",
        licence: "CC0",
      });

      expect((await clientA.from("opportunities").select("id")).error).not.toBeNull();
      expect((await clientA.from("source_registry").select("id")).error).not.toBeNull();
      expect((await clientA.from("opportunity_evidence").select("id")).error).not.toBeNull();
      expect(
        (
          await clientA.from("match_evaluations").insert({
            user_id: userA,
            opportunity_id: opportunityId,
            match_score: 100,
          } as never)
        ).error,
      ).not.toBeNull();

      const fixtureIds = new Set(
        (await admin!.from("opportunities").select("id").eq("is_fixture", true)).data?.map(
          (item) => item.id,
        ) ?? [],
      );
      const published = await admin!.from("safe_active_opportunities").select("id");
      expect(published.error).toBeNull();
      expect((published.data ?? []).every((item) => item.id && !fixtureIds.has(item.id))).toBe(true);
    },
    45_000,
  );
});
