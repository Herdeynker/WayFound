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
const createdOpportunityIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdSourceIds: string[] = [];
const createdStoragePaths: string[] = [];

function userClient(key: string) {
  return createClient<Database>(url!, publicKey!, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: key },
  });
}

async function removePriorPhase9Fixtures() {
  if (!admin) return;
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  expect(users.error).toBeNull();
  const fixtures = users.data.users.filter((user) => /^phase9-[ab]-.*@example\.test$/.test(user.email ?? ""));
  for (const user of fixtures) {
    const objects = await admin.storage.from("user-documents").list(user.id, { limit: 1000 });
    expect(objects.error).toBeNull();
    const paths = (objects.data ?? [])
      .filter((item) => item.name.startsWith("phase9-") && item.id)
      .map((item) => `${user.id}/${item.name}`);
    if (paths.length) expect((await admin.storage.from("user-documents").remove(paths)).error).toBeNull();
    expect((await admin.auth.admin.deleteUser(user.id)).error).toBeNull();
  }
  const opportunities = await admin.from("opportunities").select("id").like("title", "Phase 9 opportunity %");
  for (const opportunity of opportunities.data ?? [])
    expect((await admin.from("opportunities").delete().eq("id", opportunity.id)).error).toBeNull();
  const organizations = await admin
    .from("organizations")
    .select("id")
    .like("official_name", "Phase 9 organization %");
  for (const organization of organizations.data ?? [])
    expect((await admin.from("organizations").delete().eq("id", organization.id)).error).toBeNull();
  const sources = await admin.from("source_registry").select("id").like("source_name", "Phase 9 source %");
  for (const source of sources.data ?? [])
    expect((await admin.from("source_registry").delete().eq("id", source.id)).error).toBeNull();
}

describe("Phase 9 private documents and applications", () => {
  beforeAll(removePriorPhase9Fixtures, 45_000);
  afterAll(async () => {
    if (!admin) return;
    if (createdStoragePaths.length)
      expect((await admin.storage.from("user-documents").remove(createdStoragePaths)).error).toBeNull();
    for (const userId of createdUsers) expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
    for (const id of createdOpportunityIds)
      expect((await admin.from("opportunities").delete().eq("id", id)).error).toBeNull();
    for (const id of createdOrganizationIds)
      expect((await admin.from("organizations").delete().eq("id", id)).error).toBeNull();
    for (const id of createdSourceIds)
      expect((await admin.from("source_registry").delete().eq("id", id)).error).toBeNull();
  }, 45_000);

  testCase(
    "keeps versions, storage, workspaces and status history private and idempotent",
    async () => {
      const password = `Phase9-${crypto.randomUUID()}-Safe!`;
      const [createdA, createdB] = await Promise.all(
        ["a", "b"].map((suffix) =>
          admin!.auth.admin.createUser({
            email: `phase9-${suffix}-${crypto.randomUUID()}@example.test`,
            password,
            email_confirm: true,
          }),
        ),
      );
      const userA = createdA.data.user!.id;
      const userB = createdB.data.user!.id;
      createdUsers.push(userA, userB);
      const clientA = userClient(`phase9-a-${crypto.randomUUID()}`);
      const clientB = userClient(`phase9-b-${crypto.randomUUID()}`);
      const anonymous = userClient(`phase9-anon-${crypto.randomUUID()}`);
      await Promise.all([
        clientA.auth.signInWithPassword({ email: createdA.data.user!.email!, password }),
        clientB.auth.signInWithPassword({ email: createdB.data.user!.email!, password }),
      ]);

      const parent = await admin!
        .from("document_metadata")
        .insert({
          user_id: userA,
          document_type: `Passport-${crypto.randomUUID()}`,
          category: "identity",
          readiness_status: "available",
        })
        .select("id")
        .single();
      expect(parent.error).toBeNull();
      const version = await clientA
        .from("document_versions")
        .insert({
          document_id: parent.data!.id,
          user_id: userA,
          storage_path: `${userA}/${parent.data!.id}/passport.pdf`,
          original_filename: "passport.pdf",
          mime_type: "application/pdf",
          size_bytes: 5,
          checksum_sha256: "a".repeat(64),
          version_number: 1,
          idempotency_key: crypto.randomUUID(),
        })
        .select("id")
        .single();
      expect(version.error).toBeNull();
      const anonymousVersions = await anonymous
        .from("document_versions")
        .select("id")
        .eq("id", version.data!.id);
      expect(anonymousVersions.data ?? []).toHaveLength(0);
      expect(anonymousVersions.error).not.toBeNull();
      expect(
        (await clientB.from("document_versions").select("id").eq("id", version.data!.id)).data,
      ).toHaveLength(0);
      expect(
        (
          await clientB.from("document_versions").insert({
            document_id: parent.data!.id,
            user_id: userB,
            storage_path: `${userB}/${parent.data!.id}/forged.pdf`,
            original_filename: "forged.pdf",
            mime_type: "application/pdf",
            size_bytes: 5,
            checksum_sha256: "b".repeat(64),
            version_number: 1,
            idempotency_key: crypto.randomUUID(),
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await clientA
            .from("document_versions")
            .update({ original_filename: "changed.pdf" })
            .eq("id", version.data!.id)
            .select("id")
        ).data,
      ).toHaveLength(0);
      expect(
        (await clientA.from("document_versions").delete().eq("id", version.data!.id).select("id")).data,
      ).toHaveLength(0);
      const bytes = new Uint8Array([37, 80, 68, 70, 45]);
      const objectPath = `${userA}/phase9-${crypto.randomUUID()}.pdf`;
      createdStoragePaths.push(objectPath);
      expect(
        (
          await clientA.storage
            .from("user-documents")
            .upload(objectPath, bytes, { contentType: "application/pdf" })
        ).error,
      ).toBeNull();
      const signed = await clientA.storage.from("user-documents").createSignedUrl(objectPath, 1);
      expect(signed.error).toBeNull();
      expect(
        (await clientB.storage.from("user-documents").createSignedUrl(objectPath, 1)).error,
      ).not.toBeNull();
      expect(
        (await anonymous.storage.from("user-documents").createSignedUrl(objectPath, 1)).error,
      ).not.toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      expect((await fetch(signed.data!.signedUrl)).ok).toBe(false);

      const marker = crypto.randomUUID();
      const country = await admin!.from("countries").select("id").eq("iso_alpha2", "CN").single();
      const type = await admin!.from("opportunity_types").select("id").eq("code", "scholarship").single();
      const organization = await admin!
        .from("organizations")
        .insert({
          official_name: `Phase 9 organization ${marker}`,
          normalized_name: `phase-9-organization-${marker}`,
          organization_type: "university",
          country_id: country.data!.id,
        })
        .select("id")
        .single();
      createdOrganizationIds.push(organization.data!.id);
      const source = await admin!
        .from("source_registry")
        .insert({
          source_name: `Phase 9 source ${marker}`,
          source_type: "approved_scholarship_directory",
          base_url: `https://phase9-${marker}.example.test`,
          canonical_domain: `phase9-${marker}.example.test`,
          country_id: country.data!.id,
          trust_tier: 2,
          is_allowed: true,
          active: true,
          terms_review_status: "approved",
          robots_policy_status: "allowed",
        })
        .select("id")
        .single();
      createdSourceIds.push(source.data!.id);
      const createdOpportunity = await admin!
        .from("opportunities")
        .insert({
          opportunity_type_id: type.data!.id,
          organization_id: organization.data!.id,
          title: `Phase 9 opportunity ${marker}`,
          normalized_title: `phase-9-opportunity-${marker}`,
          destination_country_id: country.data!.id,
          application_deadline: "2027-12-31",
          application_url: `https://phase9-${marker}.example.test/apply`,
          original_source_url: `https://phase9-${marker}.example.test/apply`,
          lifecycle_status: "active",
          evidence_status: "sourced",
          last_checked_at: new Date().toISOString(),
          canonical_duplicate_key: `phase9:${marker}`,
        })
        .select("id")
        .single();
      expect(createdOpportunity.error).toBeNull();
      createdOpportunityIds.push(createdOpportunity.data!.id);
      expect(
        (
          await admin!.from("opportunity_sources").insert({
            opportunity_id: createdOpportunity.data!.id,
            source_id: source.data!.id,
            source_url: `https://phase9-${marker}.example.test/apply`,
            relationship_type: "primary_listing",
            source_priority: 1,
            is_primary: true,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await admin!.from("opportunity_evidence").insert({
            opportunity_id: createdOpportunity.data!.id,
            source_id: source.data!.id,
            source_url: `https://phase9-${marker}.example.test/apply`,
            evidence_type: "listing",
            fact_path: "opportunity.title",
            captured_excerpt: "Phase 9 integration provenance.",
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await admin!
            .from("opportunities")
            .update({ publication_status: "published" })
            .eq("id", createdOpportunity.data!.id)
        ).error,
      ).toBeNull();
      expect(
        (
          await admin!.from("opportunity_documents").insert({
            opportunity_id: createdOpportunity.data!.id,
            document_type: "transcript",
            original_wording: "Official transcript required",
            requirement_status: "required",
            notes: "Upload the institution-issued transcript.",
          })
        ).error,
      ).toBeNull();
      const safeOpportunity = await admin!
        .from("safe_active_opportunities")
        .select("id")
        .eq("id", createdOpportunity.data!.id)
        .single();
      expect(safeOpportunity.error).toBeNull();
      const opportunityVersion = await admin!
        .from("opportunity_versions")
        .select("id")
        .eq("opportunity_id", safeOpportunity.data!.id!)
        .limit(1)
        .single();
      const profile = await admin!
        .from("profile_versions")
        .insert({
          user_id: userA,
          version_number: 9001,
          trigger: "manual_review",
          snapshot: { selectedGoals: ["study_funding"] },
        })
        .select("id")
        .single();
      const match = await admin!
        .from("match_evaluations")
        .insert({
          user_id: userA,
          profile_version_id: profile.data!.id,
          opportunity_id: safeOpportunity.data!.id!,
          opportunity_version_id: opportunityVersion.data!.id,
          algorithm_version: "phase9.test.v1",
          scoring_configuration_version: "phase9.test.v1",
          input_fingerprint: crypto.randomUUID(),
          candidate_rank: 1,
          eligibility_outcome: "more_information_needed",
          publication_decision: "limited",
          match_score: 50,
          readiness_state: "unknown",
          selection_factors: {},
        })
        .select("id")
        .single();
      expect(match.error).toBeNull();
      const requestKey = crypto.randomUUID();
      const first = await clientA.rpc("phase9_create_application_workspace", {
        candidate_match_id: match.data!.id,
        request_key: requestKey,
      });
      const second = await clientA.rpc("phase9_create_application_workspace", {
        candidate_match_id: match.data!.id,
        request_key: requestKey,
      });
      expect(first.error).toBeNull();
      expect(second.data).toBe(first.data);
      const anonymousApplications = await anonymous.from("applications").select("id").eq("id", first.data!);
      expect(anonymousApplications.data ?? []).toHaveLength(0);
      expect(anonymousApplications.error).not.toBeNull();
      expect((await clientB.from("applications").select("id").eq("id", first.data!)).data).toHaveLength(0);
      const application = await clientA
        .from("applications")
        .select("official_deadline,status")
        .eq("id", first.data!)
        .single();
      expect(application.data).toMatchObject({ official_deadline: "2027-12-31", status: "interested" });
      const checklist = await clientA
        .from("application_checklist_items")
        .select("id,title,sort_order")
        .eq("application_id", first.data!)
        .order("sort_order");
      expect(checklist.data).toHaveLength(1);
      expect(checklist.data?.[0]).toMatchObject({ title: "Official transcript required", sort_order: 0 });
      expect(
        (
          await clientB.from("application_notes").insert({
            application_id: first.data!,
            user_id: userB,
            body: "Cross-user note",
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await clientA.from("application_notes").insert({
            application_id: first.data!,
            user_id: userB,
            body: "Forged owner note",
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await clientA.from("application_document_links").insert({
            application_id: first.data!,
            checklist_item_id: checklist.data![0].id,
            document_version_id: version.data!.id,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await clientA.from("application_reminders").insert({
            application_id: first.data!,
            user_id: userA,
            reminder_at: "2027-10-01T08:00:00.000Z",
            message: "Review transcript",
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await clientB.rpc("phase9_transition_application_status", {
            candidate_application_id: first.data!,
            target_status: "preparing",
            optional_note: "",
            request_key: crypto.randomUUID(),
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await clientA.rpc("phase9_transition_application_status", {
            candidate_application_id: first.data!,
            target_status: "preparing",
            optional_note: "",
            request_key: crypto.randomUUID(),
          })
        ).data,
      ).toBe("preparing");
      expect(
        (
          await clientA
            .from("application_status_events")
            .update({ note: "changed" })
            .eq("application_id", first.data!)
            .select("id")
        ).data,
      ).toHaveLength(0);
    },
    45_000,
  );
});
