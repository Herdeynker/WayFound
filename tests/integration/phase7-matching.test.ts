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
const users: string[] = [];

describe("Phase 7 match persistence and RLS", () => {
  afterAll(async () => {
    for (const userId of users) await admin?.auth.admin.deleteUser(userId);
  });
  testCase(
    "keeps versions consistent, history immutable and feedback owner-only",
    async () => {
      const password = `Phase7-${crypto.randomUUID()}-Safe!`;
      const [a, b] = await Promise.all(
        ["a", "b"].map((suffix) =>
          admin!.auth.admin.createUser({
            email: `phase7-${suffix}-${crypto.randomUUID()}@example.test`,
            password,
            email_confirm: true,
          }),
        ),
      );
      const userA = a.data.user!.id;
      const userB = b.data.user!.id;
      users.push(userA, userB);
      const [profileA, profileB] = await Promise.all([
        admin!
          .from("profile_versions")
          .insert({
            user_id: userA,
            version_number: 7001,
            trigger: "manual_review",
            snapshot: { selectedGoals: ["study_funding"] },
          })
          .select("id")
          .single(),
        admin!
          .from("profile_versions")
          .insert({
            user_id: userB,
            version_number: 7001,
            trigger: "manual_review",
            snapshot: { selectedGoals: ["study_funding"] },
          })
          .select("id")
          .single(),
      ]);
      expect(profileA.error).toBeNull();
      expect(profileB.error).toBeNull();
      const opportunity = await admin!.from("opportunities").select("id").limit(1).single();
      const version = await admin!
        .from("opportunity_versions")
        .select("id")
        .eq("opportunity_id", opportunity.data!.id)
        .limit(1)
        .single();
      const base = {
        user_id: userA,
        profile_version_id: profileA.data!.id,
        opportunity_id: opportunity.data!.id,
        opportunity_version_id: version.data!.id,
        algorithm_version: "phase7.test.v1",
        scoring_configuration_version: "phase7.test.scoring.v1",
        input_fingerprint: crypto.randomUUID(),
        candidate_rank: 1,
        eligibility_outcome: "more_information_needed",
        publication_decision: "limited",
        match_score: 50,
        readiness_state: "unknown",
        selection_factors: {},
      };
      const created = await admin!.from("match_evaluations").insert(base).select("id").single();
      expect(created.error).toBeNull();
      expect((await admin!.from("match_evaluations").insert(base)).error).not.toBeNull();
      expect(
        (
          await admin!.from("match_evaluations").insert({
            ...base,
            input_fingerprint: crypto.randomUUID(),
            profile_version_id: profileB.data!.id,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (await admin!.from("match_evaluations").update({ match_score: 51 }).eq("id", created.data!.id)).error,
      ).not.toBeNull();
      const action = await admin!
        .from("match_next_actions")
        .insert({
          match_evaluation_id: created.data!.id,
          action_type: "complete_passport_field",
          priority: 50,
          title: "Complete your Passport",
          explanation: "More information is needed.",
        })
        .select("id")
        .single();
      expect(action.error).toBeNull();
      const clientA = createClient(url!, publicKey!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          storageKey: `phase7-a-${crypto.randomUUID()}`,
        },
      });
      const clientB = createClient(url!, publicKey!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          storageKey: `phase7-b-${crypto.randomUUID()}`,
        },
      });
      await Promise.all([
        clientA.auth.signInWithPassword({ email: a.data.user!.email!, password }),
        clientB.auth.signInWithPassword({ email: b.data.user!.email!, password }),
      ]);
      expect((await clientA.from("match_evaluations").select("id")).data).toHaveLength(1);
      expect((await clientB.from("match_evaluations").select("id")).data).toHaveLength(0);
      expect(
        (
          await createClient(url!, publicKey!, { auth: { autoRefreshToken: false, persistSession: false } })
            .from("match_evaluations")
            .select("id")
        ).error,
      ).not.toBeNull();
      expect(
        (
          await (
            createClient(url!, publicKey!, {
              auth: { autoRefreshToken: false, persistSession: false },
            }) as unknown as {
              rpc(name: string, args: Record<string, string>): Promise<{ error: unknown | null }>;
            }
          ).rpc("phase7_match_owner", { match_id: created.data!.id })
        ).error,
      ).not.toBeNull();
      expect(
        (await clientA.from("match_next_actions").update({ status: "completed" }).eq("id", action.data!.id))
          .error,
      ).toBeNull();
      expect(
        (await clientA.from("match_next_actions").update({ title: "forged" }).eq("id", action.data!.id))
          .error,
      ).not.toBeNull();
      expect(
        (
          await clientB.from("match_feedback_events").insert({
            user_id: userA,
            match_evaluation_id: created.data!.id,
            event_type: "match_viewed",
            idempotency_key: crypto.randomUUID(),
            metadata: {},
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await clientA.from("match_feedback_events").insert({
            user_id: userA,
            match_evaluation_id: created.data!.id,
            event_type: "match_viewed",
            idempotency_key: crypto.randomUUID(),
            metadata: {},
          })
        ).error,
      ).toBeNull();
    },
    30_000,
  );
});
