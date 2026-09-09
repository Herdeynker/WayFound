import "server-only";

import { z } from "zod";

export const errorClassifications = [
  "timeout",
  "rate_limited",
  "temporary_http",
  "permanent_http",
  "invalid_content",
  "policy_blocked",
  "adapter_failure",
  "validation_failure",
  "unknown",
] as const;
export type ErrorClassification = (typeof errorClassifications)[number];

export const sourcePolicySchema = z
  .object({
    sourceId: z.string().uuid(),
    sourceType: z.enum([
      "official_government",
      "official_university",
      "official_employer",
      "official_scholarship_body",
      "official_sponsor_register",
      "approved_job_board",
      "approved_scholarship_directory",
      "search_provider",
    ]),
    discoveryMethod: z.enum(["official_feed", "search_provider", "partner_feed"]),
    adapterIdentifier: z.string().regex(/^[a-z0-9.-]{3,80}$/),
    adapterVersion: z.string().regex(/^[a-z0-9._-]{1,80}$/),
    active: z.literal(true),
    allowed: z.literal(true),
    isFixture: z.literal(false),
    robotsStatus: z.literal("allowed"),
    termsStatus: z.literal("approved"),
    allowedDomains: z
      .array(z.string().regex(/^[a-z0-9.-]+$/))
      .min(1)
      .max(32),
    requestTimeoutMs: z.number().int().min(1000).max(30000),
    responseSizeLimitBytes: z.number().int().min(1024).max(5242880),
    redirectLimit: z.number().int().min(0).max(5),
    retryLimit: z.number().int().min(0).max(5),
    concurrencyLimit: z.number().int().min(1).max(8),
  })
  .strict();
export type SourcePolicy = z.infer<typeof sourcePolicySchema>;

export const evidenceFragmentSchema = z
  .object({
    factPath: z.string().min(1).max(160),
    excerpt: z.string().trim().min(1).max(4000),
    sourceUrl: z.string().url().max(2048),
    language: z
      .string()
      .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/)
      .optional(),
    publishedAt: z.string().datetime().optional(),
  })
  .strict();
export type EvidenceFragment = z.infer<typeof evidenceFragmentSchema>;

export const extractedCandidateSchema = z
  .object({
    externalSourceId: z.string().trim().min(1).max(240).optional(),
    canonicalUrl: z.string().url().max(2048),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    title: z.string().trim().min(1).max(500),
    normalizedTitle: z.string().trim().min(1).max(500),
    organizationName: z.string().trim().min(1).max(500),
    opportunityTypeCode: z.enum([
      "scholarship",
      "fellowship",
      "graduate_programme",
      "research_position",
      "internship",
      "professional_job",
      "skilled_trade_work",
    ]),
    destinationCountryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    lifecycleStatus: z.enum([
      "discovered",
      "active",
      "closing_soon",
      "expired",
      "withdrawn",
      "inaccessible",
      "superseded",
      "suppressed",
    ]),
    applicationDeadline: z.string().date().optional(),
    rollingDeadline: z.boolean().default(false),
    fundingCoverage: z.enum(["full", "partial", "not_stated", "not_applicable"]).default("not_stated"),
    sponsorshipStatus: z
      .enum(["not_stated", "possible", "vacancy_evidence", "visa_support", "excluded", "conflicting"])
      .default("not_stated"),
    evidence: z.array(evidenceFragmentSchema).min(1).max(24),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.destinationCountryCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A destination country is required for ingestion.",
      });
    }
    if (!value.applicationDeadline && !value.rollingDeadline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Deadline absence must be explicitly rolling." });
    }
  });
export type ExtractedCandidate = z.infer<typeof extractedCandidateSchema>;

export type SourceAdapter = {
  identifier: string;
  version: string;
  supportedSourceTypes: SourcePolicy["sourceType"][];
  discover(input: { policy: SourcePolicy; cursor: Record<string, unknown> }): Promise<{
    candidates: { url: string; externalSourceId?: string }[];
    nextCursor: Record<string, unknown>;
    complete: boolean;
  }>;
  extract(input: {
    policy: SourcePolicy;
    url: string;
    externalSourceId?: string;
  }): Promise<ExtractedCandidate>;
};

export type RetryDecision = { classification: ErrorClassification; retryable: boolean; delayMs: number };
