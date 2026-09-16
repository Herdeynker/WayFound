import { describe, expect, it } from "vitest";
import { destinationMediaFor, validateDestinationImageUrl } from "@/features/opportunities/destination-media";
import { isGoalRelatedOpportunity, rankDiscoverySections } from "@/server/opportunity-experience/ranking";

const card = (id: string, score: number | null, basis: "personalized" | "goal_related" | "explore") => ({
  id,
  matchId: null,
  title: id,
  organization: "Org",
  destination: "Canada",
  type: "Job",
  deadline: null,
  rollingDeadline: true,
  matchScore: score,
  basis,
  imageSrc: null,
  imageAlt: null,
  isClosingSoon: false,
  eligibility: "unknown",
  readiness: "unknown",
  sponsorship: "Sponsorship not stated",
  decision: "allow",
  reason: null,
  saved: false,
  dismissed: false,
  lastCheckedAt: null,
  applicationUrl: null,
});

describe("personalized discovery", () => {
  it("keeps personalized matches first and removes duplicates across fallbacks", () => {
    const ranked = rankDiscoverySections([
      {
        basis: "personalized",
        items: [card("match-2", 88, "personalized"), card("shared", 70, "personalized")],
      },
      {
        basis: "goal_related",
        items: [card("shared", null, "goal_related"), card("goal-1", null, "goal_related")],
      },
      { basis: "explore", items: [card("explore-1", null, "explore")] },
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["match-2", "shared", "goal-1", "explore-1"]);
    expect(ranked[0].matchScore).toBe(88);
    expect(ranked[2].matchScore).toBeNull();
  });

  it("selects only approved destination media and supports neutral fallback", () => {
    expect(destinationMediaFor("Berlin, Germany")?.licence).toBe("CC BY 4.0");
    expect(destinationMediaFor("Netherlands")?.src).toBe("/images/destinations/amsterdam-skyline.jpg");
    expect(destinationMediaFor("A destination with no approved photograph")).toBeNull();
    expect(validateDestinationImageUrl("/images/destinations/berlin-brandenburg-gate.jpg")).toBe(true);
    expect(validateDestinationImageUrl("http://localhost:3000/private.jpg")).toBe(false);
  });

  it("labels broad records as goal-related only when type and destination fit the Passport", () => {
    const passport = { goals: ["professional_sponsorship"], destinations: ["DE"] };
    expect(
      isGoalRelatedOpportunity({
        ...passport,
        opportunityTypeCode: "professional_job",
        destinationCountryCode: "DE",
      }),
    ).toBe(true);
    expect(
      isGoalRelatedOpportunity({
        ...passport,
        opportunityTypeCode: "scholarship",
        destinationCountryCode: "DE",
      }),
    ).toBe(false);
    expect(
      isGoalRelatedOpportunity({
        ...passport,
        opportunityTypeCode: "professional_job",
        destinationCountryCode: "CA",
      }),
    ).toBe(false);
  });
});
