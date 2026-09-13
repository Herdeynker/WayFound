import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { prepareDuplicateKey } from "@/server/opportunities/model";
import {
  supportedDestinationCodes,
  supportedOpportunityTypes,
  type DestinationCode,
  type DiscoveryOpportunityType,
  type DiscoveryQuery,
  type DuplicateDecision,
  type ExistingOpportunityIdentity,
  type PublicationCheck,
  type QueryBudgetGroup,
  type RegisteredSource,
  type SourceResolution,
} from "./types";

const destinationNames: Record<DestinationCode, string> = {
  CN: "China",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  IE: "Ireland",
  NL: "Netherlands",
  US: "United States",
  NZ: "New Zealand",
};
const opportunityTerms: Record<DiscoveryOpportunityType, string> = {
  scholarship: "scholarship undergraduate masters PhD fully funded tuition stipend",
  fellowship: "fellowship professional academic research funded",
  graduate_programme: "graduate programme trainee technology engineering finance",
  research_position: "research position PhD postdoctoral STEM health sustainability funded",
  internship: "internship student graduate research industry",
  professional_job: "professional job engineer healthcare technology visa sponsorship careers",
  skilled_trade_work: "skilled trade electrician plumber welder mechanic visa sponsorship careers",
};
const budgetGroupFor = (type: DiscoveryOpportunityType): QueryBudgetGroup => {
  if (type === "scholarship" || type === "fellowship") return "scholarship_fellowship";
  if (type === "graduate_programme" || type === "professional_job") return "professional_graduate";
  if (type === "skilled_trade_work") return "skilled_trade";
  return "research_internship";
};

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const dayNumber = (date: Date) =>
  Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);

export type QuerySignal = {
  usefulRate?: number;
  duplicateRate?: number;
  rejectionRate?: number;
  demand?: number;
  lastSearchedAt?: string;
};

export function buildQueryCatalog(year: number): Omit<DiscoveryQuery, "score">[] {
  return supportedDestinationCodes.flatMap((destination) =>
    supportedOpportunityTypes.map((type) => {
      const text = [
        year,
        destinationNames[destination],
        opportunityTerms[type],
        '"international applicants"',
        type === "professional_job" || type === "skilled_trade_work"
          ? '("visa sponsorship" OR "work authorization")'
          : '("Nigerian applicants" OR Nigeria)',
        "(government OR university OR employer OR research institute OR careers)",
        "(open OR deadline OR current OR recently published OR recently updated)",
      ].join(" ");
      return {
        templateKey: `ng.${destination.toLowerCase()}.${type}`,
        originCountryCode: "NG" as const,
        destinationCountryCode: destination,
        opportunityTypeCode: type,
        budgetGroup: budgetGroupFor(type),
        text,
        fingerprint: digest(text.toLowerCase().replace(/\s+/g, " ").trim()),
      };
    }),
  );
}

function freshnessScore(lastSearchedAt: string | undefined, now: Date): number {
  if (!lastSearchedAt) return 30;
  const ageDays = Math.max(0, (now.getTime() - Date.parse(lastSearchedAt)) / 86400000);
  return Math.min(30, Math.floor(ageDays));
}

export function buildDailyQueryPlan(
  input: {
    now?: Date;
    limit?: number;
    signals?: Record<string, QuerySignal>;
  } = {},
): DiscoveryQuery[] {
  const now = input.now ?? new Date();
  const limit = Math.max(1, Math.min(25, input.limit ?? 25));
  const rotation = dayNumber(now);
  const scored = buildQueryCatalog(now.getUTCFullYear()).map((query, index) => {
    const signal = input.signals?.[query.templateKey] ?? {};
    const underserved = ["IE", "NL", "NZ"].includes(query.destinationCountryCode) ? 12 : 0;
    const seasonal =
      [8, 9, 10, 0, 1].includes(now.getUTCMonth()) &&
      ["scholarship", "fellowship"].includes(query.opportunityTypeCode)
        ? 8
        : 0;
    const rotationScore =
      (((index - rotation) % scoredCatalogSize()) + scoredCatalogSize()) % scoredCatalogSize();
    const score =
      100 -
      rotationScore +
      Math.min(20, Math.max(0, signal.demand ?? 0)) +
      Math.round((signal.usefulRate ?? 0) * 20) -
      Math.round((signal.duplicateRate ?? 0) * 12) -
      Math.round((signal.rejectionRate ?? 0) * 15) +
      freshnessScore(signal.lastSearchedAt, now) +
      underserved +
      seasonal;
    return { ...query, score };
  });
  const quotas: Array<[QueryBudgetGroup, number]> = [
    ["scholarship_fellowship", 5],
    ["professional_graduate", 5],
    ["skilled_trade", 5],
    ["research_internship", 5],
  ];
  const selected: DiscoveryQuery[] = [];
  const add = (pool: DiscoveryQuery[], count: number) => {
    for (const query of pool.sort(
      (a, b) => b.score - a.score || a.templateKey.localeCompare(b.templateKey),
    )) {
      if (selected.length >= limit || count <= 0) break;
      if (!selected.some((item) => item.fingerprint === query.fingerprint)) {
        selected.push(query);
        count -= 1;
      }
    }
  };
  for (const [group, count] of quotas)
    add(
      scored.filter((item) => item.budgetGroup === group),
      count,
    );
  add(
    scored.filter((item) => ["IE", "NL", "NZ"].includes(item.destinationCountryCode)),
    2,
  );
  add(scored, limit - selected.length);
  return selected.slice(0, limit);
}

function scoredCatalogSize() {
  return supportedDestinationCodes.length * supportedOpportunityTypes.length;
}

const trackingParameter = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid|ref|source)$/i;
export function canonicalizeDiscoveryUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error("Unsafe discovery URL");
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || isIP(hostname))
    throw new Error("Unsafe discovery host");
  url.hostname = hostname;
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (trackingParameter.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return url.toString();
}

const domainMatches = (host: string, allowed: string) => host === allowed || host.endsWith(`.${allowed}`);
export function resolveRegisteredSource(
  urlValue: string,
  sources: readonly RegisteredSource[],
): SourceResolution {
  const url = new URL(canonicalizeDiscoveryUrl(urlValue));
  const source = sources.find((candidate) =>
    [candidate.canonicalDomain, ...candidate.allowedDomains].some((domain) =>
      domainMatches(url.hostname, domain),
    ),
  );
  if (!source) return { status: "unverified", reason: "new_domain_requires_registry_verification" };
  if (!source.active || !source.allowed || source.fixture || source.robotsStatus !== "allowed")
    return { status: "blocked", source, reason: "registered_source_policy_blocks_retrieval" };
  if (source.termsStatus !== "approved")
    return { status: "blocked", source, reason: "registered_source_terms_not_approved" };
  if (source.official && source.trustTier <= 3)
    return { status: "official", source, reason: "verified_official_registry_match" };
  if (source.sourceType === "official_sponsor_register" && source.trustTier <= 3)
    return { status: "authoritative", source, reason: "verified_authoritative_registry_match" };
  if (["approved_job_board", "approved_scholarship_directory"].includes(source.sourceType))
    return { status: "secondary", source, reason: "approved_secondary_requires_official_resolution" };
  return { status: "unverified", source, reason: "source_cannot_supply_primary_evidence" };
}

const normalized = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const yearOf = (date: string | null | undefined) => (date ? Number(date.slice(0, 4)) : null);
export function classifyDuplicate(
  candidate: {
    canonicalUrl: string;
    applicationUrl?: string;
    externalSourceId?: string;
    contentHash: string;
    normalizedTitle: string;
    organizationName: string;
    destinationCountryCode?: string;
    opportunityTypeCode: DiscoveryOpportunityType;
    deadline?: string;
  },
  existing: readonly ExistingOpportunityIdentity[],
): DuplicateDecision {
  const duplicateKey = prepareDuplicateKey({
    canonicalUrl: candidate.canonicalUrl,
    normalizedOrganization: normalized(candidate.organizationName),
    normalizedTitle: normalized(candidate.normalizedTitle),
    destinationCountryCode: candidate.destinationCountryCode,
    opportunityTypeCode: candidate.opportunityTypeCode,
    externalSourceId: candidate.externalSourceId,
  });
  for (const item of existing) {
    if (item.canonicalUrl === candidate.canonicalUrl)
      return { decision: "exact_duplicate", basis: "canonical_url", opportunityId: item.id };
    if (candidate.applicationUrl && item.applicationUrl === candidate.applicationUrl)
      return { decision: "exact_duplicate", basis: "resolved_url", opportunityId: item.id };
    if (candidate.externalSourceId && item.externalSourceId === candidate.externalSourceId)
      return { decision: "exact_duplicate", basis: "external_source_id", opportunityId: item.id };
    if (item.contentHash === candidate.contentHash)
      return { decision: "exact_duplicate", basis: "content_hash", opportunityId: item.id };
    if (item.duplicateKey === duplicateKey)
      return { decision: "exact_duplicate", basis: "canonical_duplicate_key", opportunityId: item.id };
    const sameFacts =
      normalized(item.normalizedTitle) === normalized(candidate.normalizedTitle) &&
      normalized(item.normalizedOrganization) === normalized(candidate.organizationName) &&
      item.destinationCountryCode === candidate.destinationCountryCode &&
      item.opportunityTypeCode === candidate.opportunityTypeCode;
    if (sameFacts && yearOf(item.deadline) !== yearOf(candidate.deadline))
      return { decision: "annual_cycle", basis: "annual_cycle", opportunityId: item.id };
    if (sameFacts && item.deadline === candidate.deadline)
      return { decision: "probable_duplicate", basis: "normalized_facts", opportunityId: item.id };
  }
  return { decision: "new", basis: "normalized_facts" };
}

export function isSafeOfficialApplicationUrl(value: string | undefined, source: RegisteredSource): boolean {
  if (!value) return false;
  try {
    const url = new URL(canonicalizeDiscoveryUrl(value));
    return [source.canonicalDomain, ...source.allowedDomains].some((domain) =>
      domainMatches(url.hostname, domain),
    );
  } catch {
    return false;
  }
}

export function checkPublicationSafety(input: {
  type?: string;
  title?: string;
  organization?: string;
  destination?: string;
  isGlobal?: boolean;
  sourceResolution: SourceResolution;
  applicationUrl?: string;
  deadline?: string;
  rolling?: boolean;
  evidenceCount: number;
  lifecycle: string;
  confidenceDecision?: string;
  fixture?: boolean;
  suspiciousPayment?: boolean;
  contradictory?: boolean;
}): PublicationCheck {
  const reasons: string[] = [];
  if (!supportedOpportunityTypes.includes(input.type as DiscoveryOpportunityType))
    reasons.push("invalid_type");
  if (!input.title?.trim()) reasons.push("missing_title");
  if (!input.organization?.trim()) reasons.push("missing_organization");
  if (!input.destination && !input.isGlobal) reasons.push("missing_destination");
  if (input.sourceResolution.status !== "official") reasons.push("missing_primary_evidence");
  if (
    !input.sourceResolution.source ||
    !isSafeOfficialApplicationUrl(input.applicationUrl, input.sourceResolution.source)
  )
    reasons.push("unsafe_application_url");
  if (!input.deadline && !input.rolling) reasons.push("missing_deadline_treatment");
  if (input.evidenceCount < 1) reasons.push("missing_evidence");
  if (!["active", "closing_soon"].includes(input.lifecycle)) reasons.push("inactive_lifecycle");
  if (!["allow", "limited"].includes(input.confidenceDecision ?? ""))
    reasons.push("confidence_not_publishable");
  if (input.fixture) reasons.push("fixture");
  if (input.suspiciousPayment) reasons.push("suspicious_payment");
  if (input.contradictory) reasons.push("contradictory");
  return { allowed: reasons.length === 0, reasons };
}

export function nextRecheckAt(input: {
  now?: Date;
  deadline?: string;
  sourceKind: "job" | "scholarship" | "registry";
  failedAttempts?: number;
}) {
  const now = input.now ?? new Date();
  const failures = Math.max(0, Math.min(6, input.failedAttempts ?? 0));
  const deadlineDays = input.deadline ? (Date.parse(input.deadline) - now.getTime()) / 86400000 : Infinity;
  const baseHours =
    deadlineDays <= 14 ? 24 : input.sourceKind === "job" ? 6 : input.sourceKind === "registry" ? 168 : 24;
  const hours = Math.min(168, baseHours * 2 ** failures);
  return new Date(now.getTime() + hours * 3600000);
}

const discoveryConfigSchema = z
  .object({
    OPPORTUNITY_DISCOVERY_ENABLED: z.enum(["true", "false"]).default("false"),
    OPPORTUNITY_SEARCH_PROVIDER: z.literal("brave").default("brave"),
    BRAVE_SEARCH_API_KEY: z.string().min(1).optional(),
    OPPORTUNITY_SEARCH_DAILY_LIMIT: z.coerce.number().int().min(1).max(25).default(25),
    OPPORTUNITY_SEARCH_MONTHLY_LIMIT: z.coerce.number().int().min(1).max(750).default(750),
    OPPORTUNITY_SEARCH_RESULTS_PER_QUERY: z.coerce.number().int().min(1).max(20).default(20),
    OPPORTUNITY_PAID_OVERAGE_ALLOWED: z.literal("false").default("false"),
  })
  .strict();

export type DiscoveryConfiguration = {
  enabled: boolean;
  provider: "brave";
  providerKey?: string;
  dailyLimit: number;
  monthlyLimit: number;
  resultsPerQuery: number;
  paidOverageAllowed: false;
  status: "ready" | "disabled" | "provider_disabled";
};

export function parseDiscoveryConfiguration(
  input: Record<string, string | undefined> = process.env,
): DiscoveryConfiguration {
  const parsed = discoveryConfigSchema.parse({
    OPPORTUNITY_DISCOVERY_ENABLED: input.OPPORTUNITY_DISCOVERY_ENABLED || undefined,
    OPPORTUNITY_SEARCH_PROVIDER: input.OPPORTUNITY_SEARCH_PROVIDER || undefined,
    BRAVE_SEARCH_API_KEY: input.BRAVE_SEARCH_API_KEY || undefined,
    OPPORTUNITY_SEARCH_DAILY_LIMIT: input.OPPORTUNITY_SEARCH_DAILY_LIMIT || undefined,
    OPPORTUNITY_SEARCH_MONTHLY_LIMIT: input.OPPORTUNITY_SEARCH_MONTHLY_LIMIT || undefined,
    OPPORTUNITY_SEARCH_RESULTS_PER_QUERY: input.OPPORTUNITY_SEARCH_RESULTS_PER_QUERY || undefined,
    OPPORTUNITY_PAID_OVERAGE_ALLOWED: input.OPPORTUNITY_PAID_OVERAGE_ALLOWED || undefined,
  });
  const enabled = parsed.OPPORTUNITY_DISCOVERY_ENABLED === "true";
  return {
    enabled,
    provider: parsed.OPPORTUNITY_SEARCH_PROVIDER,
    providerKey: parsed.BRAVE_SEARCH_API_KEY,
    dailyLimit: parsed.OPPORTUNITY_SEARCH_DAILY_LIMIT,
    monthlyLimit: parsed.OPPORTUNITY_SEARCH_MONTHLY_LIMIT,
    resultsPerQuery: parsed.OPPORTUNITY_SEARCH_RESULTS_PER_QUERY,
    paidOverageAllowed: false,
    status: !enabled ? "disabled" : parsed.BRAVE_SEARCH_API_KEY ? "ready" : "provider_disabled",
  };
}
