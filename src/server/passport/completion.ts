import type { GoalType, PassportState, SectionId } from "@/features/passport/model";
import { visibleSections } from "@/features/passport/model";

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
  state.education.some((item) => item.institution.trim() && item.qualificationLevel.trim());
const hasEmployment = (state: PassportState) =>
  state.employment.some((item) => item.jobTitle.trim() && item.employer.trim());
const hasSkills = (state: PassportState) => state.skills.some((item) => item.skillName.trim());
const hasTrade = (state: PassportState) => state.trade.some((item) => item.tradeOrOccupation.trim());

export function calculateCompletion(state: PassportState): CompletionResult {
  const pathways = {} as Record<GoalType, number>;
  const missing = new Set<string>();
  for (const goal of state.selectedGoals) {
    const requirements: Array<[boolean, string]> = [
      [hasOrigin(state), "origin information"],
      [hasDestination(state), "destination preferences"],
      [hasLanguage(state), "a language profile"],
    ];
    if (["study_funding", "fellowship_graduate", "research", "internship"].includes(goal))
      requirements.push([hasEducation(state), "academic history"]);
    if (["professional_sponsorship", "internship"].includes(goal))
      requirements.push([hasEmployment(state), "professional history"], [hasSkills(state), "skills"]);
    if (goal === "skilled_trade")
      requirements.push([hasTrade(state), "skilled or trade experience"], [hasSkills(state), "skills"]);
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
