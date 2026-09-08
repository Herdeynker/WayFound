import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { afterAll, describe, expect, it } from "vitest";

loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(url && publicKey && secretKey);
const testCase = live ? it : it.skip;
const admin = live
  ? createClient(url!, secretKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const createdUsers: string[] = [];

describe("Phase 3 Passport RLS and private storage", () => {
  afterAll(async () => {
    for (const userId of createdUsers) await admin?.auth.admin.deleteUser(userId);
  });

  testCase("isolates drafts, confirmed records and private storage between users", async () => {
    const password = `Phase3-${crypto.randomUUID()}-Safe!`;
    const emailA = `phase3-a-${crypto.randomUUID()}@example.test`;
    const emailB = `phase3-b-${crypto.randomUUID()}@example.test`;
    const [{ data: createdA }, { data: createdB }] = await Promise.all([
      admin!.auth.admin.createUser({ email: emailA, password, email_confirm: true }),
      admin!.auth.admin.createUser({ email: emailB, password, email_confirm: true }),
    ]);
    const userAId = createdA.user!.id;
    const userBId = createdB.user!.id;
    createdUsers.push(userAId, userBId);
    const clientA = createClient(url!, publicKey!, {
      auth: { autoRefreshToken: false, persistSession: false, storageKey: "phase3-a" },
    });
    const clientB = createClient(url!, publicKey!, {
      auth: { autoRefreshToken: false, persistSession: false, storageKey: "phase3-b" },
    });
    await clientA.auth.signInWithPassword({ email: emailA, password });
    await clientB.auth.signInWithPassword({ email: emailB, password });
    expect(
      (
        await createClient(url!, publicKey!, { auth: { autoRefreshToken: false, persistSession: false } })
          .from("onboarding_progress")
          .select("user_id")
      ).error,
    ).not.toBeNull();
    expect(
      (
        await clientA.from("onboarding_progress").upsert({
          user_id: userAId,
          selected_goal_types: ["study_funding"],
          current_section: "goals",
          draft: {},
          completion: 1,
          revision: 1,
        })
      ).error,
    ).toBeNull();
    expect(
      (await clientA.from("onboarding_progress").select("user_id").eq("user_id", userBId)).data,
    ).toHaveLength(0);
    expect(
      (
        await clientA.from("onboarding_progress").insert({
          user_id: userBId,
          draft: {},
          selected_goal_types: [],
          current_section: "goals",
          completion: 0,
          revision: 1,
        })
      ).error,
    ).not.toBeNull();
    const bucket = await admin!.storage.getBucket("user-documents");
    expect(bucket.data?.public).toBe(false);
  });
});
