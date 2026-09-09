import { describe, expect, it } from "vitest";
import {
  determineEligibility,
  evaluateRequirement,
  isApprovedFeedback,
  matchInputFingerprint,
  rankMatches,
  readinessForDocument,
  scoreMatch,
  selectCandidates,
  selectNextBestAction,
} from "@/server/matching/model";

const hard = {
  id: "r1",
  category: "years",
  operator: "greater_than_or_equal" as const,
  expected: 3,
  strength: "hard" as const,
  wording: "Three years",
};
describe("Phase 7 deterministic matching", () => {
  it("keeps every comparison operator deterministic", () => {
    expect(evaluateRequirement(hard, { years: 3 }).outcome).toBe("met");
    expect(
      evaluateRequirement({ ...hard, operator: "between", expected: { min: 2, max: 4 } }, { years: 3 })
        .outcome,
    ).toBe("met");
    expect(
      evaluateRequirement(
        { ...hard, category: "skills", operator: "contains_all", expected: ["typescript", "sql"] },
        { skills: ["typescript", "sql"] },
      ).outcome,
    ).toBe("met");
    expect(
      evaluateRequirement(
        { ...hard, category: "skills", operator: "contains_any", expected: ["typescript", "python"] },
        { skills: ["typescript"] },
      ).outcome,
    ).toBe("met");
    expect(evaluateRequirement({ ...hard, operator: "not_required" }, { years: 0 }).outcome).toBe(
      "not_applicable",
    );
  });
  it("does not turn unknown data into a failed requirement or eligibility", () => {
    const unknown = evaluateRequirement(hard, {});
    expect(unknown.outcome).toBe("unknown");
    expect(determineEligibility([unknown], "allow")).toBe("more_information_needed");
    expect(determineEligibility([evaluateRequirement(hard, { years: 1 })], "allow")).toBe(
      "not_currently_eligible",
    );
  });
  it("honours applicability, documented waivers, safety decisions and soft boundaries", () => {
    expect(
      evaluateRequirement(
        { ...hard, condition: { field: "route", operator: "equals", value: "study" } },
        { route: "work", years: 0 },
      ).outcome,
    ).toBe("not_applicable");
    expect(
      evaluateRequirement(
        {
          ...hard,
          waiver: { documented: true, condition: { field: "waived", operator: "equals", value: true } },
        },
        { waived: true, years: 0 },
      ).outcome,
    ).toBe("not_applicable");
    expect(determineEligibility([evaluateRequirement(hard, { years: 9 })], "suppress")).toBe(
      "not_actionable",
    );
    const result = scoreMatch({
      requirements: [
        { ...evaluateRequirement(hard, { years: 0 }), strength: "hard" },
        { ...evaluateRequirement({ ...hard, strength: "soft", id: "s" }, { years: 5 }), strength: "soft" },
      ],
      components: {
        goalAlignment: 100,
        destinationAlignment: 100,
        studyOrOccupationAlignment: 100,
        sponsorshipClarity: 100,
        readiness: 100,
      },
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });
  it("selects a bounded, deterministic and safe candidate set", () => {
    const selected = selectCandidates(
      [
        {
          id: "b",
          goalTypes: ["study"],
          publicationDecision: "allow",
          lifecycle: "active",
          isFixture: false,
        },
        {
          id: "a",
          goalTypes: ["study"],
          publicationDecision: "allow",
          lifecycle: "active",
          isFixture: false,
        },
        { id: "x", goalTypes: ["study"], publicationDecision: "allow", lifecycle: "active", isFixture: true },
        {
          id: "y",
          goalTypes: ["study"],
          publicationDecision: "suppress",
          lifecycle: "active",
          isFixture: false,
        },
      ],
      { goals: ["study"], destinations: [] },
    );
    expect(selected.map((item) => item.id)).toEqual(["a", "b"]);
    expect(
      rankMatches([
        { id: "z", eligibility: "eligible", score: 80 },
        { id: "a", eligibility: "eligible", score: 80 },
        { id: "n", eligibility: "not_currently_eligible", score: 100 },
      ]).map((item) => item.id),
    ).toEqual(["a", "z", "n"]);
    expect(matchInputFingerprint({ b: 2, a: [1] })).toBe(matchInputFingerprint({ a: [1], b: 2 }));
  });
  it("produces honest readiness, actions and bounded feedback", () => {
    expect(readinessForDocument(true, "available")).toBe("ready");
    expect(readinessForDocument(true, "expired")).toBe("expired");
    expect(
      selectNextBestAction({
        eligibility: "not_currently_eligible",
        readiness: "ready",
        sponsorshipLimited: false,
      }).type,
    ).toBe("review_hard_requirement");
    expect(isApprovedFeedback("match_viewed", { source: "test" })).toBe(true);
    expect(isApprovedFeedback("unknown_event", {})).toBe(false);
  });
});
