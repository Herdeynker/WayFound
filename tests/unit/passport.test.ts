import { describe, expect, it } from "vitest";
import {
  activePathways,
  emptyPassportState,
  mapLegacySectionToStage,
  materialPassportFingerprint,
  normalizeSkillName,
  onboardingStageIds,
  passportStateSchema,
  pathwayFlags,
  resolveFocusPath,
  visibleSections,
  type PassportState,
} from "@/features/passport/model";
import { calculateActivation, calculateCompletion, findContradictions } from "@/server/passport/completion";
import { cvSuggestionSchema } from "@/server/passport/cv";

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

describe("Opportunity Passport four-stage rules", () => {
  it("exposes exactly four stable activation stages", () => {
    expect(onboardingStageIds).toEqual(["goals", "background", "experience", "review"]);
  });

  it("maps every legacy eleven-step position without resetting drafts", () => {
    expect(mapLegacySectionToStage("destinations")).toBe("goals");
    expect(mapLegacySectionToStage("origin")).toBe("background");
    for (const section of [
      "academic",
      "professional",
      "skills",
      "certifications",
      "trade",
      "language",
      "documents",
    ])
      expect(mapLegacySectionToStage(section)).toBe("experience");
    expect(mapLegacySectionToStage("review")).toBe("review");
  });

  it("keeps legacy section mapping available without exposing it as the new journey", () => {
    expect(visibleSections(["study_funding"])).not.toContain("trade");
    expect(visibleSections(["skilled_trade"])).not.toContain("academic");
    expect(visibleSections(["study_funding", "skilled_trade"])).toContain("trade");
  });

  it("deduplicates shared multi-goal pathway groups", () => {
    expect(pathwayFlags(["study_funding", "research", "internship", "professional_sponsorship"])).toEqual({
      academic: true,
      research: true,
      professional: true,
      trade: false,
    });
  });

  it("requires an explicit focus only when multiple pathway groups are active", () => {
    expect(activePathways(["study_funding", "research", "internship", "professional_sponsorship"])).toEqual([
      "academic",
      "professional",
    ]);
    expect(resolveFocusPath(["study_funding"], null)).toBe("academic");
    expect(resolveFocusPath(["study_funding", "professional_sponsorship"], null)).toBeNull();
    expect(resolveFocusPath(["study_funding", "professional_sponsorship"], "exploring")).toBe("exploring");
  });

  it("accepts concise study activation while keeping Passport readiness separate", () => {
    const state = studyState();
    expect(calculateActivation(state)).toMatchObject({ complete: true, overall: 100 });
    expect(calculateCompletion(state).overall).toBeLessThan(100);
  });

  it("requires professional occupation, experience range and a basic skill", () => {
    const state: PassportState = {
      ...emptyPassportState,
      selectedGoals: ["professional_sponsorship"],
      openToOtherDestinations: true,
      employment: [
        {
          employer: "",
          jobTitle: "Accountant",
          country: "",
          employmentType: "employed",
          startDate: "2020",
          endDate: "",
          currentlyEmployed: true,
          responsibilities: "",
          achievements: "",
          industry: "",
          occupationCategory: "",
          managementExperience: null,
          remoteInternationalExperience: null,
        },
      ],
      skills: [
        {
          skillName: "Excel",
          normalizedName: "excel",
          category: "other",
          proficiency: "proficient",
          yearsExperience: null,
          evidence: "",
        },
      ],
    };
    expect(calculateActivation(state).complete).toBe(true);
    expect(calculateActivation({ ...state, skills: [] }).missing).toContain("at least one core skill");
  });

  it("allows an all-routes user to explore without treating deferred details as missing", () => {
    const state: PassportState = {
      ...studyState(),
      selectedGoals: ["study_funding", "professional_sponsorship", "skilled_trade"],
      focusPath: "exploring",
    };
    expect(calculateActivation(state)).toMatchObject({ complete: true, overall: 100 });
    expect(calculateCompletion(state).overall).toBeLessThan(100);
  });

  it("preserves zero, unknown and not-applicable trade answers as explicit values", () => {
    const state: PassportState = {
      ...emptyPassportState,
      selectedGoals: ["skilled_trade"],
      destinations: ["DE"],
      trade: [
        {
          tradeOrOccupation: "Welder",
          apprenticeshipStatus: "not_applicable",
          practicalYears: 0,
          experienceDocumentation: "informal",
          employerOrSelfEmployed: "",
          tradeCertification: "unknown",
          licensingStatus: "not_applicable",
          portfolioAvailable: null,
          toolsEquipment: "",
          drivingLicenceClasses: "",
          willingToCompleteLicensing: null,
          preferredDestination: "",
        },
      ],
    };
    expect(calculateActivation(state).complete).toBe(true);
  });

  it("detects contradictory dates and keeps normalization stable", () => {
    const state = studyState();
    state.education[0] = { ...state.education[0], startDate: "2025-01-01", completionDate: "2024-01-01" };
    expect(findContradictions(state)).toHaveLength(1);
    expect(normalizeSkillName("  Project   Management ")).toBe("project management");
  });

  it("treats record identifiers as non-material but matching facts as material", () => {
    const first = studyState();
    first.education[0] = { ...first.education[0], id: crypto.randomUUID() };
    const equivalent = structuredClone(first);
    equivalent.education[0].id = crypto.randomUUID();
    expect(materialPassportFingerprint(equivalent)).toBe(materialPassportFingerprint(first));
    equivalent.education[0].fieldOfStudy = "Data science";
    expect(materialPassportFingerprint(equivalent)).not.toBe(materialPassportFingerprint(first));
  });

  it("rejects unsupported sensitive fields and malformed CV proposals", () => {
    expect(passportStateSchema.safeParse({ ...emptyPassportState, religion: "x" }).success).toBe(false);
    expect(
      cvSuggestionSchema.safeParse({
        suggestions: [{ fieldPath: "religion", proposedValue: "x", evidence: "" }],
        provider: "fixture",
        schemaVersion: "phase3.cv.v1",
      }).success,
    ).toBe(false);
  });

  it("reads old drafts without a focus path and preserves it as an explicit null", () => {
    const { focusPath, ...legacyDraft } = emptyPassportState;
    expect(focusPath).toBeNull();
    expect(
      passportStateSchema.parse({ ...legacyDraft, selectedGoals: ["study_funding"] }).focusPath,
    ).toBeNull();
  });
});
