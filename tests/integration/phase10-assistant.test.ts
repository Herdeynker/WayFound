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
const testCase = live ? it : it.skip;
const admin = live
  ? createClient<Database>(url!, secretKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const createdUsers: string[] = [];
const createdOpportunities: string[] = [];

const userClient = (key: string) =>
  createClient<Database>(url!, publicKey!, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: key },
  });

async function clearPriorFixtures() {
  if (!admin) return;
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  expect(users.error).toBeNull();
  for (const user of users.data.users.filter((item) =>
    /^phase10-[ab]-.*@example\.test$/.test(item.email ?? ""),
  ))
    expect((await admin.auth.admin.deleteUser(user.id)).error).toBeNull();
  const opportunities = await admin
    .from("opportunities")
    .select("id")
    .like("title", "Phase 10 opportunity %");
  for (const opportunity of opportunities.data ?? [])
    expect((await admin.from("opportunities").delete().eq("id", opportunity.id)).error).toBeNull();
}

describe("Phase 10 hosted assistant security and concurrency", () => {
  beforeAll(clearPriorFixtures, 45_000);
  afterAll(async () => {
    if (!admin) return;
    for (const userId of createdUsers) expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
    for (const opportunityId of createdOpportunities)
      expect((await admin.from("opportunities").delete().eq("id", opportunityId)).error).toBeNull();
  }, 45_000);

  testCase(
    "enforces fact approval, immutable revisions, owner isolation, replay safety and atomic quota",
    async () => {
      const password = `Phase10-${crypto.randomUUID()}-Safe!`;
      const [createdA, createdB] = await Promise.all(
        ["a", "b"].map((suffix) =>
          admin!.auth.admin.createUser({
            email: `phase10-${suffix}-${crypto.randomUUID()}@example.test`,
            password,
            email_confirm: true,
          }),
        ),
      );
      expect(createdA.error).toBeNull();
      expect(createdB.error).toBeNull();
      const userA = createdA.data.user!.id;
      const userB = createdB.data.user!.id;
      createdUsers.push(userA, userB);
      const clientA = userClient(`phase10-a-${crypto.randomUUID()}`);
      const clientB = userClient(`phase10-b-${crypto.randomUUID()}`);
      const anonymous = userClient(`phase10-anon-${crypto.randomUUID()}`);
      expect(
        (await clientA.auth.signInWithPassword({ email: createdA.data.user!.email!, password })).error,
      ).toBeNull();
      expect(
        (await clientB.auth.signInWithPassword({ email: createdB.data.user!.email!, password })).error,
      ).toBeNull();

      const country = await admin!.from("countries").select("id").eq("iso_alpha2", "CN").single();
      const type = await admin!.from("opportunity_types").select("id").eq("code", "scholarship").single();
      const marker = crypto.randomUUID();
      const opportunity = await admin!
        .from("opportunities")
        .insert({
          opportunity_type_id: type.data!.id,
          title: `Phase 10 opportunity ${marker}`,
          normalized_title: `phase 10 opportunity ${marker}`,
          destination_country_id: country.data!.id,
          lifecycle_status: "discovered",
          publication_status: "draft",
          evidence_status: "unverified",
          canonical_duplicate_key: `phase10-${marker}`,
        })
        .select("id")
        .single();
      expect(opportunity.error).toBeNull();
      createdOpportunities.push(opportunity.data!.id);
      const [applicationA, applicationB] = await Promise.all(
        [userA, userB].map((userId) =>
          admin!
            .from("applications")
            .insert({ user_id: userId, opportunity_id: opportunity.data!.id })
            .select("id")
            .single(),
        ),
      );
      expect(applicationA.error).toBeNull();
      expect(applicationB.error).toBeNull();

      const factSet = await admin!
        .from("assistant_fact_sets")
        .insert({
          user_id: userA,
          application_id: applicationA.data!.id,
          opportunity_id: opportunity.data!.id,
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      expect(factSet.error).toBeNull();
      const factId = crypto.randomUUID();
      expect(
        (
          await admin!.from("assistant_source_facts").insert({
            id: factId,
            fact_set_id: factSet.data!.id,
            user_id: userA,
            category: "passport",
            label: "Confirmed qualification",
            fact_value: "BSc Computer Science",
            evidence_label: "Confirmed Passport",
            approved_at: new Date().toISOString(),
          })
        ).error,
      ).toBeNull();
      const requestKey = crypto.randomUUID();
      const draft = await admin!
        .from("assistant_drafts")
        .insert({
          user_id: userA,
          application_id: applicationA.data!.id,
          opportunity_id: opportunity.data!.id,
          fact_set_id: factSet.data!.id,
          kind: "cover_letter",
          title: "Phase 10 letter",
          tone: "clear",
          word_limit: 300,
          idempotency_key: requestKey,
        })
        .select("id")
        .single();
      expect(draft.error).toBeNull();

      expect((await anonymous.from("assistant_drafts").select("id")).error).not.toBeNull();
      expect(
        (await clientB.from("assistant_drafts").select("id").eq("id", draft.data!.id)).data,
      ).toHaveLength(0);
      expect(
        (await clientA.from("assistant_drafts").select("id").eq("id", draft.data!.id)).data,
      ).toHaveLength(1);
      expect(
        (
          await clientA.from("assistant_source_facts").insert({
            id: crypto.randomUUID(),
            fact_set_id: factSet.data!.id,
            user_id: userA,
            category: "user_evidence",
            label: "Forged direct fact",
            fact_value: "Should fail",
            evidence_label: "None",
            approved_at: new Date().toISOString(),
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await admin!.from("assistant_source_facts").insert({
            id: crypto.randomUUID(),
            fact_set_id: factSet.data!.id,
            user_id: userB,
            category: "passport",
            label: "Forged owner",
            fact_value: "Should fail",
            evidence_label: "None",
            approved_at: new Date().toISOString(),
          })
        ).error,
      ).not.toBeNull();

      const first = await clientA.rpc("phase10_reserve_generation", {
        candidate_draft_id: draft.data!.id,
        request_key: requestKey,
      });
      const replay = await clientA.rpc("phase10_reserve_generation", {
        candidate_draft_id: draft.data!.id,
        request_key: requestKey,
      });
      expect(first.error).toBeNull();
      expect(replay.data).toBe(first.data);
      expect(
        (
          await clientB.rpc("phase10_reserve_generation", {
            candidate_draft_id: draft.data!.id,
            request_key: requestKey,
          })
        ).error,
      ).not.toBeNull();

      const revision = await admin!
        .from("assistant_draft_revisions")
        .insert({
          draft_id: draft.data!.id,
          generation_request_id: first.data!,
          user_id: userA,
          revision_number: 1,
          content: "BSc Computer Science supports this application.",
          word_count: 6,
          grounding_status: "verified",
          validation_result: { fact_ids: [factId] },
          provider_name: "deterministic-test",
          model_version: "phase10-fixture-v1",
          input_fingerprint: "a".repeat(64),
        })
        .select("id")
        .single();
      expect(revision.error).toBeNull();
      expect(
        (
          await admin!
            .from("assistant_drafts")
            .update({ status: "draft", current_revision_id: revision.data!.id })
            .eq("id", draft.data!.id)
        ).error,
      ).toBeNull();
      expect(
        (
          await admin!
            .from("assistant_generation_requests")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", first.data!)
        ).error,
      ).toBeNull();
      expect(
        (
          await admin!.from("assistant_usage_ledger").insert({
            user_id: userA,
            generation_request_id: first.data!,
            provider_name: "deterministic-test",
            model_version: "phase10-fixture-v1",
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await clientA
            .from("assistant_draft_revisions")
            .update({ content: "rewritten" })
            .eq("id", revision.data!.id)
        ).error,
      ).not.toBeNull();
      expect(
        (
          await admin!
            .from("assistant_draft_revisions")
            .update({ content: "rewritten" })
            .eq("id", revision.data!.id)
        ).error,
      ).not.toBeNull();
      expect(
        (
          await clientB.rpc("phase10_approve_revision", {
            candidate_draft_id: draft.data!.id,
            candidate_revision_id: revision.data!.id,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await clientA.rpc("phase10_approve_revision", {
            candidate_draft_id: draft.data!.id,
            candidate_revision_id: revision.data!.id,
          })
        ).data,
      ).toBe(true);

      const extraDrafts = await admin!
        .from("assistant_drafts")
        .insert(
          Array.from({ length: 10 }, () => ({
            user_id: userA,
            application_id: applicationA.data!.id,
            opportunity_id: opportunity.data!.id,
            fact_set_id: factSet.data!.id,
            kind: "recruiter_message",
            title: "Quota test",
            tone: "concise",
            word_limit: 100,
            idempotency_key: crypto.randomUUID(),
          })),
        )
        .select("id,idempotency_key");
      expect(extraDrafts.error).toBeNull();
      const quotaResults = await Promise.all(
        (extraDrafts.data ?? []).map((item) =>
          clientA.rpc("phase10_reserve_generation", {
            candidate_draft_id: item.id,
            request_key: item.idempotency_key,
          }),
        ),
      );
      expect(quotaResults.filter((result) => !result.error)).toHaveLength(9);
      expect(quotaResults.filter((result) => result.error)).toHaveLength(1);
      expect((await clientB.from("assistant_usage_ledger").select("id")).data).toHaveLength(0);

      const analysis = await admin!
        .from("cv_analyses")
        .insert({
          user_id: userA,
          application_id: applicationA.data!.id,
          alignment_score: 70,
          input_fingerprint: "b".repeat(64),
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      expect(analysis.error).toBeNull();
      expect(
        (
          await admin!.from("cv_analysis_findings").insert({
            analysis_id: analysis.data!.id,
            user_id: userA,
            finding_kind: "weak",
            section_name: "experience",
            summary: "Use confirmed evidence.",
          })
        ).error,
      ).toBeNull();
      expect((await clientB.from("cv_analyses").select("id").eq("id", analysis.data!.id)).data).toHaveLength(
        0,
      );
      expect(
        (await admin!.from("cv_analyses").update({ alignment_score: 100 }).eq("id", analysis.data!.id)).error,
      ).not.toBeNull();
      const persisted = await clientA.from("cv_analyses").select("*").eq("id", analysis.data!.id).single();
      expect(persisted.error).toBeNull();
      expect(Object.keys(persisted.data!)).not.toContain("raw_cv_text");
    },
    60_000,
  );
});
