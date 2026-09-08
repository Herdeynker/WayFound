import { describe, expect, it } from "vitest";
import {
  emptyPassportState,
  visibleSections,
  normalizeSkillName,
  passportStateSchema,
} from "@/features/passport/model";
import { calculateCompletion, findContradictions } from "@/server/passport/completion";
import { cvSuggestionSchema } from "@/server/passport/cv";

describe("Opportunity Passport rules", () => {
  it("shows only the union of relevant sections for selected goals", () => {
    expect(visibleSections(["study_funding"])).not.toContain("trade");
    expect(visibleSections(["skilled_trade"])).not.toContain("academic");
    expect(visibleSections(["professional_sponsorship"])).toContain("professional");
    expect(visibleSections(["research"])).toContain("academic");
    expect(visibleSections(["study_funding", "skilled_trade"])).toContain("trade");
  });

  it("calculates deterministic pathway completion and missing requirements", () => {
    const state = {
      ...emptyPassportState,
      selectedGoals: ["study_funding" as const],
      citizenshipCountry: "NG",
      residenceCountry: "NG",
    };
    const result = calculateCompletion(state);
    expect(result.overall).toBe(25);
    expect(result.missing.some((item) => item.includes("academic history"))).toBe(true);
  });

  it("detects contradictory dates and keeps skill normalization stable", () => {
    const state = {
      ...emptyPassportState,
      selectedGoals: ["internship" as const],
      education: [
        {
          institution: "A",
          country: "NG",
          qualificationLevel: "BSc",
          fieldOfStudy: "CS",
          startDate: "2025-01-01",
          completionDate: "2024-01-01",
          graduationStatus: "completed" as const,
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
    expect(findContradictions(state)).toHaveLength(1);
    expect(normalizeSkillName("  Project   Management ")).toBe("project management");
  });

  it("rejects unsupported sensitive profile fields and malformed CV proposals", () => {
    expect(passportStateSchema.safeParse({ ...emptyPassportState, religion: "x" }).success).toBe(false);
    expect(
      cvSuggestionSchema.safeParse({
        suggestions: [{ fieldPath: "religion", proposedValue: "x", evidence: "" }],
        provider: "fixture",
        schemaVersion: "phase3.cv.v1",
      }).success,
    ).toBe(false);
  });
});
