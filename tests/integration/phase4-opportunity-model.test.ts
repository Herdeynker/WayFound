import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { afterAll, describe, expect, it } from "vitest";
import { phase4FixtureExpectations } from "@/../tests/fixtures/phase4-opportunities";

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
const createdOpportunityIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdSourceIds: string[] = [];

describe("Phase 4 opportunity model and client boundaries", () => {
  afterAll(async () => {
    if (!admin) return;
    for (const id of createdOpportunityIds) await admin.from("opportunities").delete().eq("id", id);
    for (const id of createdOrganizationIds) await admin.from("organizations").delete().eq("id", id);
    for (const id of createdSourceIds) await admin.from("source_registry").delete().eq("id", id);
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  });

  testCase(
    "represents four fixtures, rejects invalid facts, versions material changes, and protects raw tables",
    async () => {
      const fixtureRows = await admin!
        .from("opportunities")
        .select("title, is_fixture")
        .eq("is_fixture", true);
      expect(fixtureRows.error).toBeNull();
      for (const expected of phase4FixtureExpectations) {
        expect(fixtureRows.data).toContainEqual(
          expect.objectContaining({ title: expected.title, is_fixture: true }),
        );
      }

      const fixtureSponsorship = await admin!
        .from("sponsorship_evidence")
        .select("evidence_scope")
        .in("evidence_scope", ["vacancy_specific", "organization_level"]);
      expect(fixtureSponsorship.data?.map((item: { evidence_scope: string }) => item.evidence_scope)).toEqual(
        expect.arrayContaining(["vacancy_specific", "organization_level"]),
      );
      const countryModules = await admin!.from("country_modules").select("country_id");
      expect(countryModules.data).toHaveLength(9);
      const nigeria = await admin!
        .from("countries")
        .select("supported_origin,supported_destination")
        .eq("iso_alpha2", "NG")
        .single();
      expect(nigeria.data).toEqual({ supported_origin: true, supported_destination: false });

      const country = await admin!.from("countries").select("id").eq("iso_alpha2", "CN").single();
      const type = await admin!.from("opportunity_types").select("id").eq("code", "scholarship").single();
      expect(country.error).toBeNull();
      expect(type.error).toBeNull();
      if (!country.data || !type.data) throw new Error("Phase 4 taxonomies were not seeded.");
      const marker = crypto.randomUUID();
      const organization = await admin!
        .from("organizations")
        .insert({
          official_name: `Integration organization ${marker}`,
          normalized_name: `integration-organization-${marker}`,
          organization_type: "university",
          country_id: country.data.id,
        })
        .select("id")
        .single();
      expect(organization.error).toBeNull();
      if (!organization.data) throw new Error("Integration organization was not created.");
      createdOrganizationIds.push(organization.data.id);
      const source = await admin!
        .from("source_registry")
        .insert({
          source_name: `Integration source ${marker}`,
          source_type: "approved_job_board",
          base_url: `https://integration-${marker}.example.test`,
          canonical_domain: `integration-${marker}.example.test`,
          country_id: country.data.id,
          trust_tier: 2,
          is_allowed: true,
          active: true,
          terms_review_status: "approved",
          robots_policy_status: "allowed",
        })
        .select("id")
        .single();
      expect(source.error).toBeNull();
      if (!source.data) throw new Error("Integration source was not created.");
      createdSourceIds.push(source.data.id);
      const secondarySource = await admin!
        .from("source_registry")
        .insert({
          source_name: `Integration secondary source ${marker}`,
          source_type: "approved_scholarship_directory",
          base_url: `https://secondary-${marker}.example.test`,
          canonical_domain: `secondary-${marker}.example.test`,
          trust_tier: 4,
          is_allowed: true,
          active: true,
          terms_review_status: "approved",
          robots_policy_status: "allowed",
        })
        .select("id")
        .single();
      expect(secondarySource.error).toBeNull();
      if (!secondarySource.data) throw new Error("Integration secondary source was not created.");
      createdSourceIds.push(secondarySource.data.id);

      const invalidType = await admin!.from("opportunities").insert({
        opportunity_type_id: crypto.randomUUID(),
        organization_id: organization.data.id,
        title: "Invalid type",
        normalized_title: "invalid type",
        destination_country_id: country.data.id,
      });
      expect(invalidType.error).not.toBeNull();

      const invalidDates = await admin!.from("opportunities").insert({
        opportunity_type_id: type.data.id,
        organization_id: organization.data.id,
        title: "Invalid dates",
        normalized_title: "invalid dates",
        destination_country_id: country.data.id,
        application_open_date: "2027-02-02",
        application_deadline: "2027-02-01",
      });
      expect(invalidDates.error).not.toBeNull();
      const invalidAmount = await admin!.from("opportunities").insert({
        opportunity_type_id: type.data.id,
        organization_id: organization.data.id,
        title: "Invalid amount",
        normalized_title: "invalid amount",
        destination_country_id: country.data.id,
        salary_min: 100,
        salary_max: 99,
      });
      expect(invalidAmount.error).not.toBeNull();
      const invalidLifecycle = await admin!.from("opportunities").insert({
        opportunity_type_id: type.data.id,
        organization_id: organization.data.id,
        title: "Invalid lifecycle",
        normalized_title: "invalid lifecycle",
        destination_country_id: country.data.id,
        lifecycle_status: "not_a_lifecycle",
      });
      expect(invalidLifecycle.error).not.toBeNull();

      const opportunity = await admin!
        .from("opportunities")
        .insert({
          opportunity_type_id: type.data.id,
          organization_id: organization.data.id,
          title: `Integration opportunity ${marker}`,
          normalized_title: `integration opportunity ${marker}`,
          destination_country_id: country.data.id,
          application_deadline: "2027-12-31",
          application_url: `https://integration-${marker}.example.test/apply`,
          original_source_url: `https://integration-${marker}.example.test/apply`,
          lifecycle_status: "active",
          evidence_status: "sourced",
          last_checked_at: new Date().toISOString(),
          canonical_duplicate_key: `integration:${marker}`,
        })
        .select("id")
        .single();
      expect(opportunity.error).toBeNull();
      if (!opportunity.data) throw new Error("Integration opportunity was not created.");
      createdOpportunityIds.push(opportunity.data.id);

      const noEvidencePublish = await admin!
        .from("opportunities")
        .update({ publication_status: "published" })
        .eq("id", opportunity.data.id);
      expect(noEvidencePublish.error).not.toBeNull();
      const opportunitySource = await admin!.from("opportunity_sources").insert({
        opportunity_id: opportunity.data.id,
        source_id: source.data.id,
        source_url: `https://integration-${marker}.example.test/apply`,
        relationship_type: "primary_listing",
        source_priority: 1,
        is_primary: true,
      });
      expect(opportunitySource.error).toBeNull();
      const secondRelationship = await admin!.from("opportunity_sources").insert({
        opportunity_id: opportunity.data.id,
        source_id: secondarySource.data.id,
        source_url: `https://secondary-${marker}.example.test/listing`,
        relationship_type: "discovery",
        source_priority: 4,
      });
      expect(secondRelationship.error).toBeNull();
      const sourceCount = await admin!
        .from("opportunity_sources")
        .select("id", { count: "exact", head: true })
        .eq("opportunity_id", opportunity.data.id);
      expect(sourceCount.count).toBe(2);
      const evidence = await admin!.from("opportunity_evidence").insert({
        opportunity_id: opportunity.data.id,
        source_id: source.data.id,
        source_url: `https://integration-${marker}.example.test/apply`,
        evidence_type: "listing",
        fact_path: "opportunity.title",
        captured_excerpt: "Integration-only provenance excerpt.",
      });
      expect(evidence.error).toBeNull();
      const invalidRequirement = await admin!.from("opportunity_requirements").insert({
        opportunity_id: opportunity.data.id,
        requirement_category: "gpa",
        operator: "greater_than_or_equal",
        normalized_value: { state: "unknown", min: 3 },
        original_wording: "Invalid test value",
      });
      expect(invalidRequirement.error).not.toBeNull();
      const invalidOperator = await admin!.from("opportunity_requirements").insert({
        opportunity_id: opportunity.data.id,
        requirement_category: "gpa",
        operator: "unsupported_operator",
        normalized_value: { state: "known", min: 3 },
        original_wording: "Invalid operator",
      });
      expect(invalidOperator.error).not.toBeNull();
      const invalidCondition = await admin!.from("opportunity_requirements").insert({
        opportunity_id: opportunity.data.id,
        requirement_category: "gpa",
        operator: "greater_than_or_equal",
        normalized_value: { state: "known", min: 3 },
        original_wording: "Invalid condition",
        applicability_condition: { executable: "return true" },
      });
      expect(invalidCondition.error).not.toBeNull();
      const validRequirement = await admin!.from("opportunity_requirements").insert({
        opportunity_id: opportunity.data.id,
        requirement_category: "gpa",
        operator: "greater_than_or_equal",
        normalized_value: { state: "known", min: 3, scale: "4" },
        original_wording: "Integration requirement",
      });
      expect(validRequirement.error).toBeNull();
      const requirementRevision = await admin!
        .from("opportunity_requirements")
        .update({ original_wording: "Integration requirement, revised." })
        .eq("opportunity_id", opportunity.data.id);
      expect(requirementRevision.error).toBeNull();
      const publish = await admin!
        .from("opportunities")
        .update({ publication_status: "published", title: `Integration opportunity revised ${marker}` })
        .eq("id", opportunity.data.id);
      expect(publish.error).toBeNull();
      const versions = await admin!
        .from("opportunity_versions")
        .select("id")
        .eq("opportunity_id", opportunity.data.id);
      expect(versions.data?.length).toBe(6);
      const immutableUpdate = await admin!
        .from("opportunity_versions")
        .update({ reason: "manual_correction" })
        .eq("opportunity_id", opportunity.data.id);
      expect(immutableUpdate.error).not.toBeNull();

      const anonymous = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      expect((await anonymous.from("opportunities").select("id")).error).not.toBeNull();
      const safeRows = await anonymous.from("safe_active_opportunities").select("id,title");
      expect(safeRows.error).toBeNull();
      expect(safeRows.data).toContainEqual(expect.objectContaining({ id: opportunity.data.id }));
      for (const expected of phase4FixtureExpectations) {
        expect(safeRows.data?.some((item: { title: string }) => item.title === expected.title)).toBe(false);
      }
      const expire = await admin!
        .from("opportunities")
        .update({ lifecycle_status: "expired" })
        .eq("id", opportunity.data.id);
      expect(expire.error).toBeNull();
      const afterExpiry = await anonymous
        .from("safe_active_opportunities")
        .select("id")
        .eq("id", opportunity.data.id);
      expect(afterExpiry.data).toHaveLength(0);

      const password = `Phase4-${crypto.randomUUID()}-Safe!`;
      const email = `phase4-user-${crypto.randomUUID()}@example.test`;
      const user = await admin!.auth.admin.createUser({ email, password, email_confirm: true });
      expect(user.error).toBeNull();
      createdUsers.push(user.data.user!.id);
      const ordinaryClient = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false, storageKey: `phase4-${marker}` },
      });
      expect((await ordinaryClient.auth.signInWithPassword({ email, password })).error).toBeNull();
      const forbiddenWrite = await ordinaryClient.from("opportunities").insert({ title: "Nope" });
      expect(forbiddenWrite.error).not.toBeNull();
      expect((await ordinaryClient.from("source_registry").select("internal_notes")).error).not.toBeNull();
      expect(
        (await ordinaryClient.from("organizations").insert({ official_name: "Nope" })).error,
      ).not.toBeNull();
      expect((await ordinaryClient.from("opportunity_evidence").insert({})).error).not.toBeNull();
      expect((await ordinaryClient.from("sponsorship_evidence").insert({})).error).not.toBeNull();
      expect((await ordinaryClient.from("country_rules").insert({})).error).not.toBeNull();
    },
    45_000,
  );
});
