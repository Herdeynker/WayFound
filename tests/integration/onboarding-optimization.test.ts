import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { afterAll, describe, expect, it } from "vitest";
import { emptyPassportState, onboardingFlowVersion, type PassportState } from "@/features/passport/model";

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

type RpcResult = {
  data: { profile_version_id: string; version_number: number; reused: boolean } | null;
  error: { message: string } | null;
};

function confirm(client: SupabaseClient, state: PassportState): Promise<RpcResult> {
  const rpc = client.rpc.bind(client) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<RpcResult>;
  return rpc("phase16_confirm_onboarding", {
    candidate_snapshot: state,
    candidate_passport_readiness: 44,
    candidate_trigger: "initial_review",
  });
}

function studyState(): PassportState {
  return {
    ...emptyPassportState,
    selectedGoals: ["study_funding"],
    destinations: ["CA"],
    education: [
      {
        institution: "",
        country: "",
        qualificationLevel: "Bachelor's",
        fieldOfStudy: "Computer science",
        startDate: "",
        completionDate: "",
        graduationStatus: "completed",
        gradeClassification: "",
        gpaValue: null,
        gpaScale: null,
        resultPending: false,
        expectedGraduationDate: "",
        transcriptAvailable: null,
        researchExperience: "",
        publications: "",
        academicAwards: "",
      },
    ],
  };
}

describe("optimized onboarding hosted transaction and RLS", () => {
  afterAll(async () => {
    for (const userId of createdUsers) await admin?.auth.admin.deleteUser(userId);
  });

  testCase(
    "preserves legacy drafts, enforces consent and ownership, and versions only material confirmations",
    async () => {
      const password = `Onboarding-${crypto.randomUUID()}-Safe!`;
      const emailA = `onboarding-a-${crypto.randomUUID()}@example.test`;
      const emailB = `onboarding-b-${crypto.randomUUID()}@example.test`;
      const [{ data: createdA }, { data: createdB }] = await Promise.all([
        admin!.auth.admin.createUser({ email: emailA, password, email_confirm: true }),
        admin!.auth.admin.createUser({ email: emailB, password, email_confirm: true }),
      ]);
      const userAId = createdA.user!.id;
      const userBId = createdB.user!.id;
      createdUsers.push(userAId, userBId);
      const clientA = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false, storageKey: "onboarding-a" },
      });
      const clientB = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false, storageKey: "onboarding-b" },
      });
      await clientA.auth.signInWithPassword({ email: emailA, password });
      await clientB.auth.signInWithPassword({ email: emailB, password });

      expect((await confirm(clientA, studyState())).error?.message).toContain("CONSENT_REQUIRED");
      const consentRows = ["profile_matching", "ai_processing", "document_storage"].map((consentType) => ({
        user_id: userAId,
        policy_version: "2026-09-08.v1",
        consent_type: consentType,
        granted: true,
        required: true,
        source: "web",
      }));
      expect((await clientA.from("user_consents").insert(consentRows)).error).toBeNull();

      expect(
        (
          await clientA.from("onboarding_progress").upsert({
            user_id: userAId,
            selected_goal_types: ["study_funding"],
            current_section: "academic",
            draft: studyState(),
            completion: 36,
            revision: 7,
          })
        ).error,
      ).toBeNull();
      const legacy = await clientA
        .from("onboarding_progress")
        .select("current_section,revision")
        .eq("user_id", userAId)
        .single();
      expect(legacy.data).toMatchObject({ current_section: "academic", revision: 7 });

      const first = await confirm(clientA, studyState());
      expect(first.error).toBeNull();
      expect(first.data).toMatchObject({ version_number: 1, reused: false });
      const equivalent = await confirm(clientA, studyState());
      expect(equivalent.error).toBeNull();
      expect(equivalent.data).toMatchObject({
        profile_version_id: first.data!.profile_version_id,
        version_number: 1,
        reused: true,
      });

      const materialState = { ...studyState(), destinations: ["DE"] };
      const material = await confirm(clientA, materialState);
      expect(material.error).toBeNull();
      expect(material.data).toMatchObject({ version_number: 2, reused: false });

      const versions = await clientA
        .from("profile_versions")
        .select("version_number,schema_version")
        .order("version_number");
      expect(versions.data).toEqual([
        { version_number: 1, schema_version: onboardingFlowVersion },
        { version_number: 2, schema_version: onboardingFlowVersion },
      ]);
      const progress = await clientA
        .from("onboarding_progress")
        .select("current_section,completion,passport_readiness,flow_version")
        .single();
      expect(progress.data).toMatchObject({
        current_section: "review",
        completion: 100,
        passport_readiness: 44,
        flow_version: onboardingFlowVersion,
      });

      expect((await clientA.from("profile_versions").select("id").eq("user_id", userBId)).data).toHaveLength(
        0,
      );
      expect(
        (
          await clientB.from("onboarding_progress").upsert({
            user_id: userAId,
            selected_goal_types: [],
            current_section: "goals",
            draft: {},
            completion: 0,
            revision: 1,
          })
        ).error,
      ).not.toBeNull();

      const queue = await admin!
        .from("profile_match_recompute_queue" as never)
        .select("profile_version_id,status" as never)
        .eq("user_id" as never, userAId);
      expect(queue.error).toBeNull();
      expect(queue.data).toHaveLength(2);
      expect(
        (await clientA.from("profile_match_recompute_queue" as never).select("*" as never)).error,
      ).not.toBeNull();
    },
    45_000,
  );
});
