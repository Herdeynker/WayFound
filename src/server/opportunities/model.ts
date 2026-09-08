import { z } from "zod";

export const opportunityTypeCodes = [
  "scholarship",
  "fellowship",
  "graduate_programme",
  "research_position",
  "internship",
  "professional_job",
  "skilled_trade_work",
] as const;
export const lifecycleStatuses = [
  "discovered",
  "active",
  "closing_soon",
  "expired",
  "withdrawn",
  "inaccessible",
  "superseded",
  "suppressed",
] as const;
export const requirementOperators = [
  "equals",
  "not_equals",
  "in_list",
  "not_in_list",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "between",
  "contains_any",
  "contains_all",
  "exists",
  "not_required",
] as const;
export const requirementCategories = [
  "citizenship",
  "country_of_residence",
  "age_minimum",
  "age_maximum",
  "education_level",
  "degree_field",
  "grade_classification",
  "gpa",
  "graduation_status",
  "years_experience",
  "occupation",
  "skill",
  "certification",
  "professional_licence",
  "trade_experience",
  "language",
  "ielts_overall",
  "ielts_component",
  "other_language_test",
  "passport_availability",
  "funding_need",
  "work_authorization",
  "destination_eligibility",
  "application_document",
] as const;

const codeList = z.array(z.string().trim().min(1).max(80)).max(64);
export const applicabilityConditionSchema = z
  .object({
    originCountryCodes: codeList.optional(),
    studyLevelCodes: codeList.optional(),
    occupationCodes: codeList.optional(),
    hasDependants: z.boolean().optional(),
    waivedWhenDocumented: z.boolean().optional(),
  })
  .strict();

export const normalizedUnknownSchema = z.object({ state: z.literal("unknown") }).strict();
const normalizedKnownBaseSchema = z
  .object({
    state: z.literal("known"),
    value: z.union([z.string().trim().min(1), z.number().finite(), z.boolean()]).optional(),
    min: z.number().finite().nonnegative().optional(),
    max: z.number().finite().nonnegative().optional(),
    values: z
      .array(z.union([z.string().trim().min(1), z.number().finite()]))
      .min(1)
      .optional(),
    code: z.string().trim().min(1).max(120).optional(),
    scale: z.string().trim().min(1).max(80).optional(),
    countryCodes: codeList.optional(),
  })
  .strict();
export const normalizedKnownSchema = normalizedKnownBaseSchema.superRefine((value, ctx) => {
  if (![value.value, value.min, value.max, value.values, value.code].some((item) => item !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Known values need a value, range, list, or code.",
    });
  }
  if (value.min !== undefined && value.max !== undefined && value.max < value.min) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Maximum cannot be below minimum." });
  }
});
export const normalizedValueSchema = z.union([normalizedUnknownSchema, normalizedKnownSchema]);

export const moneySchema = z
  .object({
    state: z.enum(["known", "unknown"]),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    min: z.number().finite().nonnegative().optional(),
    max: z.number().finite().nonnegative().optional(),
    frequency: z.enum(["hourly", "daily", "weekly", "monthly", "annual", "one_time"]).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.state === "unknown" && Object.keys(value).length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unknown monetary facts must remain unknown." });
    }
    if (value.max !== undefined && value.min !== undefined && value.max < value.min) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Maximum cannot be below minimum." });
    }
  });

export const sponsorshipEvidenceScopeSchema = z.enum([
  "vacancy_specific",
  "organization_level",
  "country_pathway",
]);
export const sponsorshipEvidenceSchema = z
  .object({
    type: z.enum([
      "vacancy_explicit_sponsorship",
      "vacancy_explicit_visa_support",
      "vacancy_excludes_sponsorship",
      "employer_sponsor_register",
      "occupation_pathway_eligible",
      "employer_relocation_support",
      "scholarship_visa_documentation",
      "work_authorization_required",
      "not_stated",
      "conflicting",
    ]),
    scope: sponsorshipEvidenceScopeSchema,
    opportunityId: z.string().uuid().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scope === "vacancy_specific" && !value.opportunityId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Vacancy evidence must identify a vacancy." });
    }
    if (value.scope === "organization_level" && !value.organizationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Organization evidence must identify an organization.",
      });
    }
  });

export const countryModuleSchema = z
  .object({
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    supportedPathways: z.array(
      z.enum(["study", "research", "graduate", "internship", "professional_work", "skilled_trade_work"]),
    ),
    recognizedEvidenceCategories: z.array(sponsorshipEvidenceScopeSchema),
    completenessStatus: z.enum(["framework_only", "partial", "verified"]),
    productionActive: z.boolean(),
  })
  .strict();

export const countryModules = ["CN", "GB", "CA", "AU", "DE", "IE", "NL", "US", "NZ"].map((countryCode) =>
  countryModuleSchema.parse({
    countryCode,
    supportedPathways: [
      "study",
      "research",
      "graduate",
      "internship",
      "professional_work",
      "skilled_trade_work",
    ],
    recognizedEvidenceCategories: ["vacancy_specific", "organization_level", "country_pathway"],
    completenessStatus: "framework_only",
    productionActive: false,
  }),
);

export function getCountryModule(countryCode: string) {
  return countryModules.find((module) => module.countryCode === countryCode.toUpperCase()) ?? null;
}

export type PublicationCandidate = {
  isFixture: boolean;
  typeCode?: string | null;
  title?: string | null;
  organizationId?: string | null;
  destinationCountryCode?: string | null;
  isGlobal: boolean;
  applicationUrl?: string | null;
  lastCheckedAt?: string | null;
  deadline?: string | null;
  rollingDeadline: boolean;
  evidenceStatus: "unverified" | "partial" | "sourced" | "conflicting" | "fixture";
  lifecycleStatus: (typeof lifecycleStatuses)[number];
  hasPrimarySource: boolean;
  hasActiveEvidence: boolean;
};

export function publicationEligibility(candidate: PublicationCandidate) {
  const failures: string[] = [];
  if (candidate.isFixture) failures.push("fixture");
  if (!candidate.typeCode) failures.push("opportunity type");
  if (!candidate.title?.trim()) failures.push("title");
  if (!candidate.organizationId) failures.push("organization");
  if (!candidate.destinationCountryCode && !candidate.isGlobal) failures.push("destination");
  if (!candidate.applicationUrl) failures.push("application URL");
  if (!candidate.lastCheckedAt) failures.push("last checked time");
  if (!candidate.deadline && !candidate.rollingDeadline) failures.push("deadline treatment");
  if (candidate.evidenceStatus !== "sourced") failures.push("sourced evidence status");
  if (!candidate.hasPrimarySource) failures.push("primary source");
  if (!candidate.hasActiveEvidence) failures.push("active evidence");
  if (
    !(["active", "closing_soon"] as const).includes(candidate.lifecycleStatus as "active" | "closing_soon")
  ) {
    failures.push("publishable lifecycle state");
  }
  return { eligible: failures.length === 0, failures };
}

function normaliseKeyPart(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function prepareDuplicateKey(input: {
  canonicalUrl?: string | null;
  normalizedOrganization: string;
  normalizedTitle: string;
  destinationCountryCode?: string | null;
  opportunityTypeCode: (typeof opportunityTypeCodes)[number];
  externalSourceId?: string | null;
}) {
  if (input.canonicalUrl?.trim()) return `url:${normaliseKeyPart(input.canonicalUrl)}`;
  return [
    "facts",
    normaliseKeyPart(input.normalizedOrganization),
    normaliseKeyPart(input.normalizedTitle),
    normaliseKeyPart(input.destinationCountryCode),
    input.opportunityTypeCode,
    normaliseKeyPart(input.externalSourceId),
  ].join(":");
}

export type VersionableOpportunity = Pick<
  PublicationCandidate,
  "title" | "organizationId" | "deadline" | "applicationUrl" | "lifecycleStatus"
> & { sponsorshipStatus: string };

export function hasMaterialOpportunityChange(before: VersionableOpportunity, after: VersionableOpportunity) {
  return (
    before.title !== after.title ||
    before.organizationId !== after.organizationId ||
    before.deadline !== after.deadline ||
    before.applicationUrl !== after.applicationUrl ||
    before.lifecycleStatus !== after.lifecycleStatus ||
    before.sponsorshipStatus !== after.sponsorshipStatus
  );
}

export const safeOpportunitySchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1),
    opportunity_type_code: z.enum(opportunityTypeCodes),
    organization_name: z.string().min(1),
    destination_country_code: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
    is_global: z.boolean(),
    application_url: z.string().url(),
    application_deadline: z.string().date().nullable(),
    rolling_deadline: z.boolean(),
    lifecycle_status: z.enum(["active", "closing_soon"]),
    last_checked_at: z.string().datetime(),
  })
  .strict();

export type SafeOpportunity = z.infer<typeof safeOpportunitySchema>;
export function mapSafeOpportunity(row: unknown): SafeOpportunity {
  return safeOpportunitySchema.parse(row);
}
