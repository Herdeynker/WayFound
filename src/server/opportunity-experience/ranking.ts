import type { OpportunityCardModel } from "./query";

const opportunityTypesByGoal: Record<string, readonly string[]> = {
  study_funding: ["scholarship"],
  fellowship_graduate: ["fellowship", "graduate_programme"],
  research: ["fellowship", "research_position"],
  internship: ["internship"],
  professional_sponsorship: ["graduate_programme", "professional_job"],
  skilled_trade: ["skilled_trade_work"],
};

/** Labels a fallback as goal-related only when its type and destination fit the confirmed Passport. */
export function isGoalRelatedOpportunity(input: {
  opportunityTypeCode: string | null;
  destinationCountryCode: string | null;
  goals: readonly string[];
  destinations: readonly string[];
}) {
  const typeMatches = input.goals.some((goal) =>
    opportunityTypesByGoal[goal]?.includes(input.opportunityTypeCode ?? ""),
  );
  if (!typeMatches) return false;
  const destinations = input.destinations.map((code) => code.toUpperCase());
  return (
    destinations.length === 0 ||
    !input.destinationCountryCode ||
    destinations.includes(input.destinationCountryCode.toUpperCase())
  );
}

/** Stable, duplicate-free hierarchy used by dashboard and feed presenters. */
export function rankDiscoverySections(
  sections: Array<{ basis: OpportunityCardModel["basis"]; items: OpportunityCardModel[] }>,
  limit = 12,
) {
  const seen = new Set<string>();
  const result: OpportunityCardModel[] = [];
  for (const section of sections) {
    const ordered = [...section.items].sort(
      (a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1) || a.id.localeCompare(b.id),
    );
    for (const item of ordered) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push({ ...item, basis: section.basis });
      if (result.length === limit) return result;
    }
  }
  return result;
}
