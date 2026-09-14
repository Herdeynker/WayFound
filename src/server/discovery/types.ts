import "server-only";

import { z } from "zod";

export const supportedDestinationCodes = ["CN", "GB", "CA", "AU", "DE", "IE", "NL", "US", "NZ"] as const;
export const supportedOpportunityTypes = [
  "scholarship",
  "fellowship",
  "graduate_programme",
  "research_position",
  "internship",
  "professional_job",
  "skilled_trade_work",
] as const;
export type DestinationCode = (typeof supportedDestinationCodes)[number];
export type DiscoveryOpportunityType = (typeof supportedOpportunityTypes)[number];

export const discoveryStages = [
  "query_generation",
  "web_discovery",
  "known_source_monitoring",
  "lead_resolution",
  "retrieval",
  "extraction",
  "validation",
  "deduplication",
  "confidence",
  "publication",
  "matching",
  "notification",
  "recheck",
  "retry",
  "cleanup",
] as const;
export type DiscoveryStage = (typeof discoveryStages)[number];

export const searchResultSchema = z
  .object({
    url: z.string().url().max(2048),
    title: z.string().trim().min(1).max(500),
    snippet: z.string().trim().max(1000).default(""),
    position: z.number().int().min(1).max(20),
    language: z
      .string()
      .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/)
      .optional(),
    providerResultId: z.string().trim().max(240).optional(),
  })
  .strict();
export type SearchResult = z.infer<typeof searchResultSchema>;

export type SearchResponse = {
  results: SearchResult[];
  providerRequestId?: string;
};

export interface SearchProvider {
  readonly name: "brave";
  search(query: string, resultCount: number, signal?: AbortSignal): Promise<SearchResponse>;
}

export type QueryBudgetGroup =
  | "scholarship_fellowship"
  | "professional_graduate"
  | "skilled_trade"
  | "research_internship"
  | "underserved"
  | "reserve";

export type DiscoveryQuery = {
  templateKey: string;
  originCountryCode: "NG";
  destinationCountryCode: DestinationCode;
  opportunityTypeCode: DiscoveryOpportunityType;
  budgetGroup: QueryBudgetGroup;
  text: string;
  fingerprint: string;
  score: number;
};

export type RegisteredSource = {
  id: string;
  baseUrl: string;
  canonicalDomain: string;
  allowedDomains: string[];
  sourceType:
    | "official_government"
    | "official_university"
    | "official_employer"
    | "official_scholarship_body"
    | "official_sponsor_register"
    | "approved_job_board"
    | "approved_scholarship_directory"
    | "search_provider";
  trustTier: number;
  official: boolean;
  allowed: boolean;
  active: boolean;
  fixture: boolean;
  robotsStatus: "unknown" | "allowed" | "disallowed" | "review_required";
  termsStatus: "not_reviewed" | "approved" | "restricted" | "blocked";
  requestTimeoutMs: number;
  responseSizeLimitBytes: number;
  redirectLimit: number;
  retryLimit: number;
  concurrencyLimit: number;
  monitoringMethod?:
    "api" | "rss" | "atom" | "sitemap" | "structured_listing" | "json_ld" | "static_html" | "adapter";
  refreshFrequencyHours?: number;
  nextEligibleRunAt?: string;
  lastEtag?: string;
  lastModified?: string;
  lastContentHash?: string;
};

export type SourceResolution = {
  status: "official" | "authoritative" | "secondary" | "unverified" | "blocked";
  source?: RegisteredSource;
  reason: string;
};

export const discoveredOpportunitySchema = z
  .object({
    externalSourceId: z.string().trim().min(1).max(240).optional(),
    canonicalUrl: z.string().url().max(2048),
    applicationUrl: z.string().url().max(2048).optional(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    title: z.string().trim().min(1).max(500),
    normalizedTitle: z.string().trim().min(1).max(500),
    organizationName: z.string().trim().min(1).max(500),
    opportunityTypeCode: z.enum(supportedOpportunityTypes),
    destinationCountryCode: z.enum(supportedDestinationCodes).optional(),
    isGlobal: z.boolean().default(false),
    summary: z.string().trim().max(2000).optional(),
    applicationOpenDate: z.string().date().optional(),
    applicationDeadline: z.string().date().optional(),
    rollingDeadline: z.boolean().default(false),
    lifecycleStatus: z.enum(["active", "closing_soon", "expired", "withdrawn", "inaccessible"]),
    fundingCoverage: z.enum(["full", "partial", "not_stated", "not_applicable"]).default("not_stated"),
    sponsorshipStatus: z
      .enum(["not_stated", "possible", "vacancy_evidence", "visa_support", "excluded", "conflicting"])
      .default("not_stated"),
    evidence: z
      .array(
        z
          .object({
            factPath: z.string().trim().min(1).max(160),
            excerpt: z.string().trim().min(1).max(4000),
            sourceUrl: z.string().url().max(2048),
            publishedAt: z.string().datetime().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict();
export type DiscoveredOpportunity = z.infer<typeof discoveredOpportunitySchema>;

export type ExistingOpportunityIdentity = {
  id: string;
  canonicalUrl?: string | null;
  applicationUrl?: string | null;
  externalSourceId?: string | null;
  contentHash?: string | null;
  duplicateKey?: string | null;
  normalizedTitle: string;
  normalizedOrganization: string;
  destinationCountryCode?: string | null;
  opportunityTypeCode: string;
  deadline?: string | null;
};

export type DuplicateDecision = {
  decision: "new" | "exact_duplicate" | "probable_duplicate" | "distinct" | "annual_cycle";
  basis:
    | "canonical_url"
    | "resolved_url"
    | "external_source_id"
    | "content_hash"
    | "canonical_duplicate_key"
    | "normalized_facts"
    | "annual_cycle";
  opportunityId?: string;
};

export type PublicationCheck = {
  allowed: boolean;
  reasons: string[];
};

export type QuotaConsumption = {
  allowed: boolean;
  dailyUsed: number;
  monthlyUsed: number;
  dailyRemaining: number;
  monthlyRemaining: number;
};

export interface DiscoveryStore {
  saveQueries(queries: DiscoveryQuery[], scheduledFor: string): Promise<number>;
  consumeQuota(dailyLimit: number, monthlyLimit: number): Promise<QuotaConsumption>;
  nextQueuedQuery(
    workerId: string,
    leaseSeconds: number,
  ): Promise<{
    id: string;
    text: string;
    fingerprint: string;
  } | null>;
  beginSearch(queryId: string, resultCount: number, now: Date): Promise<string>;
  saveSearchResults(input: {
    searchRunId: string;
    queryId: string;
    results: SearchResult[];
    providerRequestId?: string;
    now: Date;
  }): Promise<{ created: number; duplicates: number; rejected: number }>;
  failSearch(queryId: string, searchRunId: string | null, code: string, retryable: boolean): Promise<void>;
  finishSearch(
    queryId: string,
    searchRunId: string,
    resultCount: number,
    metrics?: { created: number; duplicates: number; rejected: number },
  ): Promise<void>;
}

export type ClaimedLead = {
  id: string;
  canonicalUrl: string;
  resultUrl: string;
  resultDomain: string;
  resultTitle: string;
};

export type PublishedOpportunity = {
  opportunityId: string;
  opportunityVersionId: string;
  confidenceAssessmentId: string;
  created: boolean;
};

export interface AutonomousDiscoveryStore extends DiscoveryStore {
  listRegisteredSources(): Promise<RegisteredSource[]>;
  claimLeads(workerId: string, batchSize: number, leaseSeconds: number): Promise<ClaimedLead[]>;
  recordResolution(input: {
    leadId: string;
    candidateUrl: string;
    resolvedUrl?: string;
    sourceId?: string;
    sourceStrength:
      | "official_opportunity"
      | "official_organization"
      | "official_authority"
      | "authoritative_registry"
      | "approved_secondary"
      | "unverified_lead";
    status: "resolved" | "unresolved" | "blocked" | "retry";
    reason?: string;
  }): Promise<void>;
  recordRetrieval(input: {
    leadId: string;
    sourceId: string;
    method: "api" | "rss" | "atom" | "sitemap" | "json_ld" | "static_html" | "adapter" | "ai";
    requestUrl: string;
    finalUrl?: string;
    status: "succeeded" | "not_modified" | "blocked" | "timeout" | "rate_limited" | "unsupported" | "failed";
    statusCode?: number;
    contentType?: string;
    contentHash?: string;
    etag?: string;
    lastModified?: string;
    byteLength?: number;
    errorCode?: string;
  }): Promise<string>;
  updateSourceMonitorState(
    sourceId: string,
    state: { etag?: string; lastModified?: string; contentHash?: string },
  ): Promise<void>;
  recordExtraction(input: {
    leadId: string;
    retrievalAttemptId?: string;
    method: "source_adapter" | "structured_api" | "feed" | "json_ld" | "generic_html" | "bounded_ai";
    status: "accepted" | "incomplete" | "malformed" | "conflicting" | "rejected";
    explicitFacts: number;
    unknownFacts: number;
    evidenceFragments: number;
    errorCode?: string;
  }): Promise<void>;
  completeLead(
    leadId: string,
    status: "unresolved" | "published" | "rejected" | "retry" | "dead_letter",
    reason?: string,
  ): Promise<void>;
  publishCandidate(input: {
    leadId: string;
    sourceId: string;
    candidate: DiscoveredOpportunity;
  }): Promise<PublishedOpportunity>;
  dispatchMatchingAndNotifications(
    published: PublishedOpportunity,
    candidate: DiscoveredOpportunity,
  ): Promise<{ matches: number; notifications: number; failures?: number }>;
  saveDirectSourceLead(input: {
    sourceId: string;
    url: string;
    title: string;
    fingerprint: string;
  }): Promise<boolean>;
}
