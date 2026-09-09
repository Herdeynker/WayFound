import "server-only";

export type SponsorshipOutcome =
  | "explicitly_confirmed"
  | "strong_vacancy_indication"
  | "possible_not_confirmed"
  | "organization_capability_only"
  | "not_stated"
  | "explicitly_unavailable"
  | "conflicting"
  | "insufficient_evidence";
export type PublicationDecision =
  "allow" | "limited" | "more_evidence" | "suppress" | "inaccessible" | "expired" | "withdrawn" | "recheck";

export type ConfidenceEvidence = {
  scope: "vacancy_specific" | "organization_level" | "country_pathway";
  kind:
    | "sponsorship"
    | "visa_support"
    | "sponsorship_excluded"
    | "employer_register"
    | "relocation"
    | "work_authorization"
    | "scholarship_visa_documentation";
  trustTier: number;
  active: boolean;
  stale: boolean;
  superseded: boolean;
  copiedContent?: boolean;
};

export function assessSourceConfidence(input: {
  trustTier: number;
  hasPrimaryEvidence: boolean;
  fresh: boolean;
  canonicalDomainMatches: boolean;
  redirectConsistent: boolean;
  evidenceSufficient: boolean;
  contradictory: boolean;
  suspiciousPayment: boolean;
}) {
  const critical = input.suspiciousPayment;
  let score = Math.max(0, Math.min(100, 100 - Math.max(0, input.trustTier - 1) * 12));
  for (const failed of [
    !input.hasPrimaryEvidence,
    !input.fresh,
    !input.canonicalDomainMatches,
    !input.redirectConsistent,
    !input.evidenceSufficient,
    input.contradictory,
  ])
    if (failed) score -= 15;
  return {
    score: Math.max(0, score),
    critical,
    sufficient: input.hasPrimaryEvidence && input.fresh && input.evidenceSufficient && !input.contradictory,
  };
}

export function assessSponsorship(evidence: readonly ConfidenceEvidence[]): SponsorshipOutcome {
  const current = evidence.filter(
    (item) => item.active && !item.stale && !item.superseded && !item.copiedContent,
  );
  const vacancyConfirms = current.some(
    (item) => item.scope === "vacancy_specific" && item.kind === "sponsorship",
  );
  const vacancyExcludes = current.some(
    (item) => item.scope === "vacancy_specific" && item.kind === "sponsorship_excluded",
  );
  if (vacancyConfirms && vacancyExcludes) return "conflicting";
  if (vacancyExcludes) return "explicitly_unavailable";
  if (vacancyConfirms) return "explicitly_confirmed";
  if (current.some((item) => item.scope === "vacancy_specific" && item.kind === "visa_support"))
    return "strong_vacancy_indication";
  if (current.some((item) => item.scope === "organization_level" && item.kind === "employer_register"))
    return "organization_capability_only";
  return current.length ? "not_stated" : "insufficient_evidence";
}

export function decidePublication(input: {
  lifecycle: "active" | "closing_soon" | "expired" | "withdrawn" | "inaccessible" | "suppressed";
  evidenceSufficient: boolean;
  contradiction: boolean;
  suspiciousPayment: boolean;
  repeatedFailureCount: number;
  sponsorship: SponsorshipOutcome;
}): PublicationDecision {
  if (input.lifecycle === "expired") return "expired";
  if (input.lifecycle === "withdrawn") return "withdrawn";
  if (input.lifecycle === "suppressed" || input.suspiciousPayment) return "suppress";
  if (input.lifecycle === "inaccessible" && input.repeatedFailureCount >= 3) return "inaccessible";
  if (input.lifecycle === "inaccessible") return "recheck";
  if (input.contradiction || !input.evidenceSufficient || input.sponsorship === "conflicting")
    return "more_evidence";
  if (input.sponsorship === "insufficient_evidence" || input.sponsorship === "not_stated") return "limited";
  return "allow";
}
