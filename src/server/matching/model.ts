import "server-only";
import { createHash } from "node:crypto";

export const MATCH_ALGORITHM_VERSION = "phase7.v1";
export const SCORING_CONFIGURATION_VERSION = "phase7.scoring.v1";
export const MAX_CANDIDATES = 100;

export type RequirementOutcome =
  "met" | "not_met" | "unknown" | "not_applicable" | "conflicting" | "manual_confirmation_required";
export type EligibilityOutcome =
  | "eligible"
  | "not_currently_eligible"
  | "more_information_needed"
  | "manual_confirmation_required"
  | "not_actionable";
export type RequirementOperator =
  | "equals"
  | "not_equals"
  | "in_list"
  | "not_in_list"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "between"
  | "contains_any"
  | "contains_all"
  | "exists"
  | "not_required";
export type RequirementStrength = "hard" | "soft" | "informational";
export type PublicationDecision =
  "allow" | "limited" | "more_evidence" | "suppress" | "inaccessible" | "expired" | "withdrawn" | "recheck";

export type Condition = { field: string; operator: "equals" | "exists"; value?: unknown };
export type MatchRequirement = {
  id: string;
  category: string;
  operator: RequirementOperator;
  expected?: unknown;
  strength: RequirementStrength;
  missingResult?: "unknown" | "not_applicable";
  condition?: Condition;
  waiver?: { documented: boolean; condition: Condition };
  evidenceId?: string;
  wording: string;
};
export type EvaluatedRequirement = MatchRequirement & { outcome: RequirementOutcome; explanation: string };

function isMissing(value: unknown) {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);
}
function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}
function conditionOutcome(condition: Condition | undefined, values: Record<string, unknown>) {
  if (!condition) return "met" as const;
  const actual = values[condition.field];
  if (isMissing(actual)) return "unknown" as const;
  return condition.operator === "exists" ? "met" : actual === condition.value ? "met" : "not_met";
}

export function evaluateRequirement(
  requirement: MatchRequirement,
  values: Record<string, unknown>,
): EvaluatedRequirement {
  const applicability = conditionOutcome(requirement.condition, values);
  if (applicability === "not_met")
    return {
      ...requirement,
      outcome: "not_applicable",
      explanation: "This condition does not apply to this Passport.",
    };
  if (applicability === "unknown")
    return {
      ...requirement,
      outcome: "manual_confirmation_required",
      explanation: "Applicability needs confirmation before this requirement can be evaluated.",
    };
  if (requirement.waiver?.documented && conditionOutcome(requirement.waiver.condition, values) === "met")
    return { ...requirement, outcome: "not_applicable", explanation: "A documented waiver applies." };
  if (requirement.operator === "not_required")
    return {
      ...requirement,
      outcome: "not_applicable",
      explanation: "This item is explicitly not required.",
    };
  const actual = values[requirement.category];
  if (isMissing(actual))
    return {
      ...requirement,
      outcome: requirement.missingResult ?? "unknown",
      explanation: "The Passport does not yet contain evidence for this requirement.",
    };
  if (requirement.expected === undefined || requirement.expected === null)
    return {
      ...requirement,
      outcome: "unknown",
      explanation: "The opportunity requirement has no verified comparison value.",
    };
  const expected = requirement.expected;
  const actualList = asList(actual);
  const expectedList = asList(expected);
  const numbers = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  let passes = false;
  switch (requirement.operator) {
    case "equals":
      passes = actualList.some((value) => value === expected);
      break;
    case "not_equals":
      passes = actualList.every((value) => value !== expected);
      break;
    case "in_list":
      passes = actualList.some((value) => expectedList.includes(value));
      break;
    case "not_in_list":
      passes = actualList.every((value) => !expectedList.includes(value));
      break;
    case "greater_than":
      passes = numbers(actual) && numbers(expected) && actual > expected;
      break;
    case "greater_than_or_equal":
      passes = numbers(actual) && numbers(expected) && actual >= expected;
      break;
    case "less_than":
      passes = numbers(actual) && numbers(expected) && actual < expected;
      break;
    case "less_than_or_equal":
      passes = numbers(actual) && numbers(expected) && actual <= expected;
      break;
    case "between": {
      const range = expected as { min?: unknown; max?: unknown };
      passes =
        numbers(actual) &&
        numbers(range.min) &&
        numbers(range.max) &&
        actual >= range.min &&
        actual <= range.max;
      break;
    }
    case "contains_any":
      passes = expectedList.some((value) => actualList.includes(value));
      break;
    case "contains_all":
      passes = expectedList.every((value) => actualList.includes(value));
      break;
    case "exists":
      passes = !isMissing(actual);
      break;
  }
  return {
    ...requirement,
    outcome: passes ? "met" : "not_met",
    explanation: passes
      ? "The confirmed Passport satisfies this requirement."
      : "The confirmed Passport does not satisfy this requirement.",
  };
}

export function determineEligibility(
  results: readonly EvaluatedRequirement[],
  decision: PublicationDecision,
): EligibilityOutcome {
  if (["suppress", "inaccessible", "expired", "withdrawn"].includes(decision)) return "not_actionable";
  const hard = results.filter((item) => item.strength === "hard");
  if (hard.some((item) => item.outcome === "not_met")) return "not_currently_eligible";
  if (hard.some((item) => item.outcome === "conflicting" || item.outcome === "manual_confirmation_required"))
    return "manual_confirmation_required";
  if (hard.some((item) => item.outcome === "unknown")) return "more_information_needed";
  return "eligible";
}

export const scoringConfiguration = {
  version: SCORING_CONFIGURATION_VERSION,
  weights: {
    softRequirements: 45,
    goalAlignment: 20,
    destinationAlignment: 15,
    studyOrOccupationAlignment: 10,
    sponsorshipClarity: 5,
    readiness: 5,
  },
} as const;

export function scoreMatch(input: {
  requirements: readonly EvaluatedRequirement[];
  components: Partial<Record<keyof typeof scoringConfiguration.weights, number>>;
}) {
  const soft = input.requirements.filter((item) => item.strength === "soft");
  const softScore = soft.length
    ? Math.round((soft.filter((item) => item.outcome === "met").length / soft.length) * 100)
    : 0;
  const components = { ...input.components, softRequirements: softScore };
  const entries = Object.entries(scoringConfiguration.weights) as Array<
    [keyof typeof scoringConfiguration.weights, number]
  >;
  const score = entries.reduce(
    (total, [name, weight]) =>
      total + Math.round((Math.max(0, Math.min(100, components[name] ?? 0)) * weight) / 100),
    0,
  );
  return { score: Math.max(0, Math.min(100, score)), components };
}

export type Candidate = {
  id: string;
  goalTypes: string[];
  destination?: string;
  publicationDecision: PublicationDecision;
  lifecycle: string;
  isFixture: boolean;
  deadline?: string | null;
};
export function selectCandidates(
  candidates: readonly Candidate[],
  profile: { goals: readonly string[]; destinations: readonly string[] },
  today = new Date().toISOString().slice(0, 10),
) {
  return candidates
    .filter(
      (item) =>
        !item.isFixture &&
        !["suppress", "inaccessible", "expired", "withdrawn"].includes(item.publicationDecision),
    )
    .filter((item) => !["expired", "withdrawn", "inaccessible", "suppressed"].includes(item.lifecycle))
    .filter((item) => !item.deadline || item.deadline >= today)
    .filter((item) => item.goalTypes.some((goal) => profile.goals.includes(goal)))
    .filter(
      (item) =>
        !item.destination || !profile.destinations.length || profile.destinations.includes(item.destination),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, MAX_CANDIDATES);
}

export function rankMatches<
  T extends { id: string; eligibility: EligibilityOutcome; score: number; deadline?: string | null },
>(matches: readonly T[]) {
  const eligibilityRank: Record<EligibilityOutcome, number> = {
    eligible: 0,
    more_information_needed: 1,
    manual_confirmation_required: 2,
    not_currently_eligible: 3,
    not_actionable: 4,
  };
  return [...matches].sort((a, b) => {
    const eligibleDifference = eligibilityRank[a.eligibility] - eligibilityRank[b.eligibility];
    if (eligibleDifference) return eligibleDifference;
    const scoreDifference = Math.max(0, Math.min(100, b.score)) - Math.max(0, Math.min(100, a.score));
    if (scoreDifference) return scoreDifference;
    const deadlineDifference = (a.deadline ?? "9999-12-31").localeCompare(b.deadline ?? "9999-12-31");
    return deadlineDifference || a.id.localeCompare(b.id);
  });
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableValue(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
export function matchInputFingerprint(input: Record<string, unknown>) {
  return createHash("sha256").update(stableValue(input)).digest("hex");
}

export type ReadinessState =
  "ready" | "missing" | "in_progress" | "expired" | "unknown" | "conditional" | "not_applicable";
export function readinessForDocument(
  required: boolean,
  status: "available" | "unavailable" | "expired" | "pending" | "not_applicable" | undefined,
): ReadinessState {
  if (!required) return "not_applicable";
  if (!status) return "unknown";
  if (status === "available") return "ready";
  if (status === "pending") return "in_progress";
  if (status === "expired") return "expired";
  return "missing";
}

export type NextAction = {
  type:
    | "complete_passport_field"
    | "obtain_document"
    | "update_document"
    | "confirm_qualification"
    | "provide_language_information"
    | "review_hard_requirement"
    | "verify_sponsorship_wording"
    | "apply_before_deadline"
    | "skip_non_actionable";
  priority: number;
  reason: string;
};
export function selectNextBestAction(input: {
  eligibility: EligibilityOutcome;
  readiness: ReadinessState;
  deadline?: string | null;
  sponsorshipLimited: boolean;
}): NextAction {
  if (input.eligibility === "not_actionable")
    return {
      type: "skip_non_actionable",
      priority: 100,
      reason: "This opportunity is not currently actionable.",
    };
  if (input.eligibility === "not_currently_eligible")
    return {
      type: "review_hard_requirement",
      priority: 90,
      reason: "Review the documented hard requirement before taking further steps.",
    };
  if (input.eligibility === "more_information_needed")
    return {
      type: "complete_passport_field",
      priority: 80,
      reason: "Complete the missing Passport information needed for eligibility.",
    };
  if (input.eligibility === "manual_confirmation_required")
    return {
      type: "confirm_qualification",
      priority: 75,
      reason: "Confirm the information that requires manual review.",
    };
  if (input.readiness === "expired")
    return { type: "update_document", priority: 70, reason: "Update the expired document before applying." };
  if (["missing", "unknown"].includes(input.readiness))
    return {
      type: "obtain_document",
      priority: 65,
      reason: "Prepare the required document; an upload alone is not official validation.",
    };
  if (input.sponsorshipLimited)
    return {
      type: "verify_sponsorship_wording",
      priority: 55,
      reason: "Verify the opportunity's current sponsorship wording from its source.",
    };
  if (input.deadline)
    return {
      type: "apply_before_deadline",
      priority: 40,
      reason: "Review the documented deadline before choosing whether to apply.",
    };
  return { type: "complete_passport_field", priority: 20, reason: "Keep your confirmed Passport current." };
}

export const feedbackEventTypes = [
  "match_viewed",
  "match_useful",
  "match_not_useful",
  "match_saved",
  "match_unsaved",
  "match_dismissed",
  "reason_selected",
  "missing_information_supplied",
  "next_action_acknowledged",
  "next_action_completed",
  "application_intent",
] as const;
export function isApprovedFeedback(type: string, metadata: unknown) {
  return (
    (feedbackEventTypes as readonly string[]).includes(type) &&
    !!metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    JSON.stringify(metadata).length <= 4096
  );
}
