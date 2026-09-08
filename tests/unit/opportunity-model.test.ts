import { describe, expect, it } from "vitest";
import {
  applicabilityConditionSchema,
  countryModules,
  getCountryModule,
  hasMaterialOpportunityChange,
  moneySchema,
  normalizedValueSchema,
  opportunityTypeCodes,
  prepareDuplicateKey,
  publicationEligibility,
  requirementOperators,
  sponsorshipEvidenceSchema,
} from "@/server/opportunities/model";

describe("Phase 4 opportunity domain model", () => {
  it("uses stable opportunity types, lifecycle operators, and bounded conditions", () => {
    expect(opportunityTypeCodes).toContain("skilled_trade_work");
    expect(requirementOperators).toContain("between");
    expect(
      applicabilityConditionSchema.safeParse({
        originCountryCodes: ["NG"],
        studyLevelCodes: ["masters"],
        hasDependants: false,
      }).success,
    ).toBe(true);
    expect(applicabilityConditionSchema.safeParse({ executable: "return true" }).success).toBe(false);
  });

  it("preserves unknown values without converting them to zero or false", () => {
    expect(normalizedValueSchema.parse({ state: "unknown" })).toEqual({ state: "unknown" });
    expect(normalizedValueSchema.safeParse({ state: "unknown", value: 0 }).success).toBe(false);
    expect(moneySchema.parse({ state: "unknown" })).toEqual({ state: "unknown" });
    expect(moneySchema.safeParse({ state: "known", min: 100, max: 99, currency: "USD" }).success).toBe(false);
  });

  it("keeps vacancy sponsorship separate from employer-register evidence", () => {
    expect(
      sponsorshipEvidenceSchema.safeParse({
        type: "employer_sponsor_register",
        scope: "organization_level",
        organizationId: crypto.randomUUID(),
      }).success,
    ).toBe(true);
    expect(
      sponsorshipEvidenceSchema.safeParse({
        type: "vacancy_explicit_sponsorship",
        scope: "vacancy_specific",
      }).success,
    ).toBe(false);
  });

  it("loads only framework-only country modules and does not invent legal facts", () => {
    expect(countryModules).toHaveLength(9);
    expect(getCountryModule("ca")?.productionActive).toBe(false);
    expect(getCountryModule("NG")).toBeNull();
  });

  it("requires source-backed, non-fixture opportunities before publication", () => {
    const base = {
      isFixture: false,
      typeCode: "scholarship",
      title: "Example",
      organizationId: crypto.randomUUID(),
      destinationCountryCode: "CN",
      isGlobal: false,
      applicationUrl: "https://example.test/apply",
      lastCheckedAt: new Date().toISOString(),
      deadline: "2027-01-01",
      rollingDeadline: false,
      evidenceStatus: "sourced" as const,
      lifecycleStatus: "active" as const,
      hasPrimarySource: true,
      hasActiveEvidence: true,
    };
    expect(publicationEligibility(base).eligible).toBe(true);
    expect(publicationEligibility({ ...base, isFixture: true }).eligible).toBe(false);
    expect(publicationEligibility({ ...base, deadline: null }).failures).toContain("deadline treatment");
    expect(publicationEligibility({ ...base, hasActiveEvidence: false }).failures).toContain(
      "active evidence",
    );
  });

  it("prepares deterministic duplicate keys and ignores timestamp-only changes", () => {
    const key = prepareDuplicateKey({
      normalizedOrganization: "Fixture University",
      normalizedTitle: "Master’s Scholarship",
      destinationCountryCode: "CN",
      opportunityTypeCode: "scholarship",
      externalSourceId: "abc-1",
    });
    expect(key).toBe("facts:fixture-university:master-s-scholarship:cn:scholarship:abc-1");
    const before = {
      title: "Title",
      organizationId: "org",
      deadline: "2027-01-01",
      applicationUrl: "https://example.test",
      lifecycleStatus: "active" as const,
      sponsorshipStatus: "not_stated",
    };
    expect(hasMaterialOpportunityChange(before, { ...before })).toBe(false);
    expect(hasMaterialOpportunityChange(before, { ...before, deadline: "2027-02-01" })).toBe(true);
  });
});
