import type { GoalType, PassportState, SectionId } from "@/features/passport/model";
import { pathwayFlags, visibleSections } from "@/features/passport/model";

export type CompletionResult = {
  overall: number;
  pathways: Record<GoalType, number>;
  missing: string[];
  relevantSections: SectionId[];
};

const hasOrigin = (state: PassportState) => Boolean(state.citizenshipCountry && state.residenceCountry);
const hasDestination = (state: PassportState) =>
  state.destinations.length > 0 || state.openToOtherDestinations;
const hasLanguage = (state: PassportState) => state.languages.some((item) => item.language.trim().length > 0);
const hasEducation = (state: PassportState) =>
  state.education.some(
    (item) => item.qualificationLevel.trim() && item.fieldOfStudy.trim() && item.graduationStatus,
  );
const hasEmployment = (state: PassportState) =>
  state.employment.some((item) => item.jobTitle.trim() && item.employmentType.trim());
const hasProfessionalExperience = (state: PassportState) =>
  state.employment.some((item) => item.jobTitle.trim() && item.startDate.trim());
const hasSkills = (state: PassportState) => state.skills.some((item) => item.skillName.trim());
const hasTrade = (state: PassportState) => state.trade.some((item) => item.tradeOrOccupation.trim());
const hasTradeExperience = (state: PassportState) =>
  state.trade.some(
    (item) =>
      item.tradeOrOccupation.trim() &&
      item.practicalYears !== null &&
      item.practicalYears !== undefined &&
      item.tradeCertification.trim() &&
      item.licensingStatus,
  );

export type ActivationResult = {
  overall: number;
  complete: boolean;
  missing: string[];
  requiredAnswerCount: number;
};

/** Minimum confirmed data needed to produce honest initial matching inputs. */
export function calculateActivation(state: PassportState): ActivationResult {
  const requirements = new Map<string, boolean>([
    ["at least one active goal", state.selectedGoals.length > 0],
    ["a destination or open-to-destinations choice", hasDestination(state)],
    ["country of citizenship", Boolean(state.citizenshipCountry.trim())],
    ["country of residence", Boolean(state.residenceCountry.trim())],
  ]);
  const flags = pathwayFlags(state.selectedGoals);
  if (flags.academic) requirements.set("qualification, field and graduation status", hasEducation(state));
  if (flags.professional) {
    requirements.set("current occupation and employment status", hasEmployment(state));
    requirements.set("professional experience range", hasProfessionalExperience(state));
    requirements.set("at least one core skill", hasSkills(state));
  }
  if (flags.trade) requirements.set("trade experience and credential status", hasTradeExperience(state));
  const missing = [...requirements].filter(([, met]) => !met).map(([label]) => label);
  const met = requirements.size - missing.length;
  return {
    overall: requirements.size ? Math.round((met / requirements.size) * 100) : 0,
    complete: missing.length === 0,
    missing,
    requiredAnswerCount: requirements.size,
  };
}

export function calculateCompletion(state: PassportState): CompletionResult {
  const pathways = {} as Record<GoalType, number>;
  const missing = new Set<string>();
  for (const goal of state.selectedGoals) {
    const requirements: Array<[boolean, string]> = [
      [hasOrigin(state), "origin information"],
      [hasDestination(state), "destination preferences"],
      [hasLanguage(state), "a language profile"],
      [state.documents.length > 0, "document readiness"],
    ];
    if (["study_funding", "fellowship_graduate", "research", "internship"].includes(goal))
      requirements.push(
        [hasEducation(state), "education basis"],
        [state.education.some((item) => item.institution.trim()), "academic history"],
        [state.education.some((item) => item.gradeClassification.trim()), "grade or classification"],
      );
    if (["professional_sponsorship", "internship"].includes(goal))
      requirements.push(
        [hasEmployment(state), "occupation basis"],
        [hasProfessionalExperience(state), "experience range"],
        [state.employment.some((item) => item.employer.trim()), "employment history"],
        [hasSkills(state), "skills"],
        [state.certifications.length > 0, "certifications"],
      );
    if (goal === "skilled_trade")
      requirements.push(
        [hasTrade(state), "trade basis"],
        [hasTradeExperience(state), "trade experience and credential status"],
        [hasSkills(state), "skills"],
      );
    const complete = requirements.filter(([value]) => value).length;
    pathways[goal] = Math.round((complete / requirements.length) * 100);
    requirements.filter(([value]) => !value).forEach(([, label]) => missing.add(`${goal}: ${label}`));
  }
  const values = Object.values(pathways);
  return {
    overall: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0,
    pathways,
    missing: [...missing],
    relevantSections: visibleSections(state.selectedGoals),
  };
}

export function findContradictions(state: PassportState): string[] {
  const issues: string[] = [];
  for (const record of state.education)
    if (record.startDate && record.completionDate && record.startDate > record.completionDate)
      issues.push("An education start date is after its completion date.");
  for (const record of state.employment)
    if (record.startDate && record.endDate && record.startDate > record.endDate)
      issues.push("An employment start date is after its end date.");
  for (const record of state.languages)
    if (record.testStatus === "official" && record.overallScore === null)
      issues.push("An official language result needs an overall score.");
  return [...new Set(issues)];
}
