import { describe, expect, it } from "vitest";
import { assessSourceConfidence, assessSponsorship, decidePublication } from "@/server/confidence/model";

describe("Phase 6 confidence safety semantics", () => {
  it("never promotes employer-register or visa-support evidence to confirmed sponsorship", () => {
    expect(
      assessSponsorship([
        {
          scope: "organization_level",
          kind: "employer_register",
          trustTier: 1,
          active: true,
          stale: false,
          superseded: false,
        },
      ]),
    ).toBe("organization_capability_only");
    expect(
      assessSponsorship([
        {
          scope: "vacancy_specific",
          kind: "visa_support",
          trustTier: 1,
          active: true,
          stale: false,
          superseded: false,
        },
      ]),
    ).toBe("strong_vacancy_indication");
  });
  it("keeps conflict and critical safety conditions above unrelated positive signals", () => {
    expect(
      assessSponsorship([
        {
          scope: "vacancy_specific",
          kind: "sponsorship",
          trustTier: 1,
          active: true,
          stale: false,
          superseded: false,
        },
        {
          scope: "vacancy_specific",
          kind: "sponsorship_excluded",
          trustTier: 1,
          active: true,
          stale: false,
          superseded: false,
        },
      ]),
    ).toBe("conflicting");
    expect(
      decidePublication({
        lifecycle: "active",
        evidenceSufficient: true,
        contradiction: false,
        suspiciousPayment: true,
        repeatedFailureCount: 0,
        sponsorship: "explicitly_confirmed",
      }),
    ).toBe("suppress");
  });
  it("keeps evidence sufficiency separate from source trust", () => {
    expect(
      assessSourceConfidence({
        trustTier: 1,
        hasPrimaryEvidence: false,
        fresh: true,
        canonicalDomainMatches: true,
        redirectConsistent: true,
        evidenceSufficient: false,
        contradictory: false,
        suspiciousPayment: false,
      }),
    ).toMatchObject({ sufficient: false, critical: false });
  });
});
