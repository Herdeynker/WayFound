import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalizeDiscoveryUrl, isSafeOfficialApplicationUrl } from "./model";
import { discoveredOpportunitySchema } from "./types";
import type {
  DiscoveredOpportunity,
  DiscoveryOpportunityType,
  RegisteredSource,
  supportedDestinationCodes,
} from "./types";

const countryNames = new Map<string, (typeof supportedDestinationCodes)[number]>([
  ["china", "CN"],
  ["united kingdom", "GB"],
  ["uk", "GB"],
  ["canada", "CA"],
  ["australia", "AU"],
  ["germany", "DE"],
  ["ireland", "IE"],
  ["netherlands", "NL"],
  ["united states", "US"],
  ["usa", "US"],
  ["new zealand", "NZ"],
]);

const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
const stripMarkup = (value: string) =>
  decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
const textMatch = (html: string, expression: RegExp) => decodeEntities(expression.exec(html)?.[1] ?? "");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizeHashText = (value: string | undefined) => value?.replace(/\s+/g, " ").trim() ?? null;
const semanticContentHash = (input: {
  sourceId: string;
  canonicalUrl: string;
  applicationUrl?: string;
  title: string;
  organizationName: string;
  opportunityTypeCode: DiscoveryOpportunityType;
  destinationCountryCode?: string;
  isGlobal: boolean;
  summary?: string;
  applicationOpenDate?: string;
  applicationDeadline?: string;
  rollingDeadline: boolean;
  lifecycleStatus: string;
  fundingCoverage: string;
  sponsorshipStatus: string;
  evidenceExcerpt: string;
}) =>
  hash(
    JSON.stringify([
      input.sourceId,
      input.canonicalUrl,
      input.applicationUrl ?? null,
      normalizeHashText(input.title),
      normalizeHashText(input.organizationName),
      input.opportunityTypeCode,
      input.destinationCountryCode ?? null,
      input.isGlobal,
      normalizeHashText(input.summary),
      input.applicationOpenDate ?? null,
      input.applicationDeadline ?? null,
      input.rollingDeadline,
      input.lifecycleStatus,
      input.fundingCoverage,
      input.sponsorshipStatus,
      normalizeHashText(input.evidenceExcerpt),
    ]),
  );

function findCountry(text: string) {
  const lower = text.toLowerCase();
  return [...countryNames.entries()].find(([name]) =>
    new RegExp(`\\b${name.replace(" ", "\\s+")}\\b`, "i").test(lower),
  )?.[1];
}

function classifyType(text: string): DiscoveryOpportunityType | undefined {
  const lower = text.toLowerCase();
  if (/\bscholarship\b/.test(lower)) return "scholarship";
  if (/\bfellowship\b/.test(lower)) return "fellowship";
  if (/\b(phd|postdoc|postdoctoral|research (position|assistant|associate))\b/.test(lower))
    return "research_position";
  if (/\bintern(ship)?\b/.test(lower)) return "internship";
  if (/\bgraduate (programme|program|scheme|trainee)\b/.test(lower)) return "graduate_programme";
  if (/\b(electrician|plumber|welder|carpenter|mechanic|technician|trade)\b/.test(lower))
    return "skilled_trade_work";
  if (/\b(job|vacancy|role|position|career)\b/.test(lower)) return "professional_job";
  return undefined;
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const direct = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())?.[1];
  if (direct && !Number.isNaN(Date.parse(`${direct}T00:00:00Z`))) return direct;
  return undefined;
}

function findDeadline(text: string): string | undefined {
  const direct = /(?:deadline|closing date|apply by)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i.exec(text)?.[1];
  return isoDate(direct);
}

function findApplicationLink(html: string, baseUrl: string): string | undefined {
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!/\b(apply|application|submit)\b/i.test(stripMarkup(match[2]))) continue;
    try {
      return canonicalizeDiscoveryUrl(new URL(match[1], baseUrl).toString());
    } catch {
      continue;
    }
  }
  return undefined;
}

const jsonLdSchema = z
  .object({
    "@type": z.union([z.string(), z.array(z.string())]).optional(),
    name: z.string().nullish(),
    title: z.string().nullish(),
    description: z.string().nullish(),
    url: z.string().nullish(),
    validThrough: z.string().nullish(),
    datePosted: z.string().nullish(),
    hiringOrganization: z
      .object({ name: z.string().nullish(), sameAs: z.unknown().optional() })
      .passthrough()
      .nullish(),
    provider: z.object({ name: z.string().nullish() }).passthrough().nullish(),
    jobLocation: z.unknown().optional(),
    applicantLocationRequirements: z.unknown().optional(),
  })
  .passthrough();

function jsonLdEntries(html: string): z.infer<typeof jsonLdSchema>[] {
  const entries: z.infer<typeof jsonLdSchema>[] = [];
  for (const block of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const raw: unknown = JSON.parse(block[1]);
      const values = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && "@graph" in raw
          ? (raw as { "@graph": unknown })["@graph"]
          : [raw];
      for (const value of Array.isArray(values) ? values : [values]) {
        const parsed = jsonLdSchema.safeParse(value);
        if (parsed.success) entries.push(parsed.data);
      }
    } catch {
      // Malformed structured data falls through to deterministic HTML extraction.
    }
  }
  return entries;
}

function structuredCandidate(input: {
  html: string;
  sourceUrl: string;
  source: RegisteredSource;
  now: Date;
}): Partial<DiscoveredOpportunity> | null {
  const entry = jsonLdEntries(input.html).find((value) => {
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    return types.some((type) =>
      ["JobPosting", "EducationalOccupationalProgram", "Course", "Scholarship"].includes(type ?? ""),
    );
  });
  if (!entry) return null;
  const title = (entry.title ?? entry.name ?? "").trim();
  const description = stripMarkup(entry.description ?? "");
  const organizationName = (entry.hiringOrganization?.name ?? entry.provider?.name ?? "").trim();
  const type = classifyType(`${title} ${description}`);
  const destination = findCountry(
    JSON.stringify([entry.jobLocation, entry.applicantLocationRequirements, description]),
  );
  const deadline = isoDate(entry.validThrough);
  const rolling = /open until filled|rolling (basis|deadline|applications)/i.test(description);
  const canonicalUrl = canonicalizeDiscoveryUrl(
    entry.url ? new URL(entry.url, input.sourceUrl).toString() : input.sourceUrl,
  );
  const applicationUrl = isSafeOfficialApplicationUrl(canonicalUrl, input.source) ? canonicalUrl : undefined;
  const lifecycleStatus = deadline && deadline < input.now.toISOString().slice(0, 10) ? "expired" : "active";
  return {
    canonicalUrl,
    applicationUrl,
    contentHash: hash(input.html),
    title,
    normalizedTitle: title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
    organizationName,
    opportunityTypeCode: type,
    destinationCountryCode: destination,
    isGlobal: /worldwide|global applicants|all nationalities/i.test(description),
    summary: description.slice(0, 2000) || undefined,
    applicationOpenDate: isoDate(entry.datePosted),
    applicationDeadline: deadline,
    rollingDeadline: rolling,
    lifecycleStatus,
    fundingCoverage: /fully funded|full tuition/i.test(description)
      ? "full"
      : /partial funding|partially funded/i.test(description)
        ? "partial"
        : "not_stated",
    sponsorshipStatus: /visa sponsorship (is )?(available|provided)|sponsor(s|ed)? (a )?work visa/i.test(
      description,
    )
      ? "vacancy_evidence"
      : /no (visa )?sponsorship|cannot sponsor/i.test(description)
        ? "excluded"
        : "not_stated",
    evidence: title ? [{ factPath: "opportunity.title", excerpt: title, sourceUrl: input.sourceUrl }] : [],
  };
}

export function extractOpportunityFromHtml(input: {
  html: string;
  sourceUrl: string;
  source: RegisteredSource;
  now?: Date;
}): { method: "json_ld" | "generic_html"; candidate?: DiscoveredOpportunity; missing: string[] } {
  if (Buffer.byteLength(input.html, "utf8") > 5_242_880)
    return { method: "generic_html", missing: ["response_too_large"] };
  const now = input.now ?? new Date();
  const structured = structuredCandidate({ ...input, now });
  const pageText = stripMarkup(input.html).slice(0, 120_000);
  const title =
    structured?.title ||
    textMatch(input.html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ||
    textMatch(input.html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const organizationName =
    structured?.organizationName ||
    textMatch(
      input.html,
      /<meta\b[^>]*(?:property|name)=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    );
  const type = structured?.opportunityTypeCode || classifyType(`${title} ${pageText.slice(0, 10000)}`);
  const destination = structured?.destinationCountryCode || findCountry(pageText);
  const deadline = structured?.applicationDeadline || findDeadline(pageText);
  const rolling =
    structured?.rollingDeadline || /open until filled|rolling (basis|deadline|applications)/i.test(pageText);
  const canonicalUrl = structured?.canonicalUrl ?? canonicalizeDiscoveryUrl(input.sourceUrl);
  const applicationUrl = structured?.applicationUrl ?? findApplicationLink(input.html, input.sourceUrl);
  const missing = [
    !title && "title",
    !organizationName && "organization",
    !type && "opportunity_type",
    !destination &&
      !(structured?.isGlobal ?? /worldwide|global applicants|all nationalities/i.test(pageText)) &&
      "destination",
    !deadline && !rolling && "deadline_treatment",
    !isSafeOfficialApplicationUrl(applicationUrl, input.source) && "safe_application_url",
  ].filter((value): value is string => Boolean(value));
  if (missing.length) return { method: structured ? "json_ld" : "generic_html", missing };
  const excerpt = pageText.slice(0, 1000);
  const isGlobal = structured?.isGlobal ?? /worldwide|global applicants|all nationalities/i.test(pageText);
  const summary = structured?.summary ?? excerpt;
  const lifecycleStatus = deadline && deadline < now.toISOString().slice(0, 10) ? "expired" : "active";
  const fundingCoverage = structured?.fundingCoverage ?? "not_stated";
  const sponsorshipStatus = structured?.sponsorshipStatus ?? "not_stated";
  const parsed = discoveredOpportunitySchema.safeParse({
    ...structured,
    canonicalUrl,
    applicationUrl,
    contentHash: semanticContentHash({
      sourceId: input.source.id,
      canonicalUrl,
      applicationUrl,
      title,
      organizationName,
      opportunityTypeCode: type!,
      destinationCountryCode: destination,
      isGlobal,
      summary,
      applicationOpenDate: structured?.applicationOpenDate,
      applicationDeadline: deadline,
      rollingDeadline: rolling,
      lifecycleStatus,
      fundingCoverage,
      sponsorshipStatus,
      evidenceExcerpt: (structured?.summary ?? excerpt) || title,
    }),
    title,
    normalizedTitle: title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
    organizationName,
    opportunityTypeCode: type,
    destinationCountryCode: destination,
    isGlobal,
    summary,
    applicationDeadline: deadline,
    rollingDeadline: rolling,
    lifecycleStatus,
    fundingCoverage,
    sponsorshipStatus,
    evidence: [
      {
        factPath: "opportunity.listing",
        excerpt: excerpt || title,
        sourceUrl: canonicalUrl,
      },
    ],
  });
  return parsed.success
    ? { method: structured ? "json_ld" : "generic_html", candidate: parsed.data, missing: [] }
    : { method: structured ? "json_ld" : "generic_html", missing: ["schema_validation"] };
}

export function extractOpportunityFromJson(input: {
  body: string;
  sourceUrl: string;
  source: RegisteredSource;
  now?: Date;
}): { method: "structured_api"; candidate?: DiscoveredOpportunity; missing: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(input.body);
  } catch {
    return { method: "structured_api", missing: ["malformed_json"] };
  }
  const firstObject = (value: unknown): Record<string, unknown> | null => {
    if (Array.isArray(value)) return firstObject(value[0]);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    for (const key of ["data", "items", "results", "opportunities", "jobs"]) {
      if (record[key]) {
        const nested = firstObject(record[key]);
        if (nested) return nested;
      }
    }
    return record;
  };
  const record = firstObject(raw);
  if (!record) return { method: "structured_api", missing: ["structured_record"] };
  const text = (key: string) => (typeof record[key] === "string" ? record[key] : undefined);
  const organization =
    record.organization && typeof record.organization === "object"
      ? (record.organization as Record<string, unknown>)
      : record.hiringOrganization && typeof record.hiringOrganization === "object"
        ? (record.hiringOrganization as Record<string, unknown>)
        : record.provider && typeof record.provider === "object"
          ? (record.provider as Record<string, unknown>)
          : {};
  const url =
    text("applicationUrl") ??
    text("application_url") ??
    text("applyUrl") ??
    text("apply_url") ??
    text("url") ??
    text("canonicalUrl") ??
    text("canonical_url") ??
    input.sourceUrl;
  const jsonLd = {
    "@type": text("@type") ?? "JobPosting",
    title: text("title") ?? text("name"),
    description: text("description") ?? text("summary"),
    validThrough:
      text("validThrough") ??
      text("valid_through") ??
      text("applicationDeadline") ??
      text("application_deadline") ??
      text("deadline"),
    datePosted: text("datePosted") ?? text("publishedAt"),
    url,
    hiringOrganization: {
      name:
        typeof organization.name === "string"
          ? organization.name
          : (text("organizationName") ??
            text("organization_name") ??
            text("organization") ??
            text("employer")),
    },
    jobLocation: record.jobLocation ?? record.location ?? record.destination ?? record.country,
    applicantLocationRequirements: record.applicantLocationRequirements,
  };
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll("<", "\\u003c")}</script></head><body></body></html>`;
  const extracted = extractOpportunityFromHtml({
    html,
    sourceUrl: input.sourceUrl,
    source: input.source,
    now: input.now,
  });
  return { method: "structured_api", candidate: extracted.candidate, missing: extracted.missing };
}

export function extractListingUrls(input: {
  body: string;
  contentType: string;
  baseUrl: string;
  limit?: number;
}): { method: "api" | "rss" | "atom" | "sitemap" | "json_ld" | "static_html"; urls: string[] } {
  const limit = Math.max(1, Math.min(100, input.limit ?? 100));
  const values: string[] = [];
  const add = (raw: string) => {
    try {
      const url = canonicalizeDiscoveryUrl(new URL(decodeEntities(raw), input.baseUrl).toString());
      if (!values.includes(url)) values.push(url);
    } catch {
      // Unsafe and malformed links are discarded at discovery.
    }
  };
  if (/application\/json/i.test(input.contentType)) {
    try {
      const raw: unknown = JSON.parse(input.body);
      const walk = (value: unknown, depth = 0) => {
        if (depth > 5 || values.length >= limit) return;
        if (typeof value === "string" && /^https:\/\//i.test(value)) add(value);
        else if (Array.isArray(value)) value.forEach((item) => walk(item, depth + 1));
        else if (value && typeof value === "object")
          Object.values(value).forEach((item) => walk(item, depth + 1));
      };
      walk(raw);
    } catch {
      return { method: "api", urls: [] };
    }
    return { method: "api", urls: values.slice(0, limit) };
  }
  if (/<urlset\b/i.test(input.body)) {
    for (const match of input.body.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) add(match[1]);
    return { method: "sitemap", urls: values.slice(0, limit) };
  }
  if (/<rss\b/i.test(input.body) || /<channel\b/i.test(input.body)) {
    for (const match of input.body.matchAll(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/gi))
      add(match[1]);
    return { method: "rss", urls: values.slice(0, limit) };
  }
  if (/<feed\b/i.test(input.body)) {
    for (const match of input.body.matchAll(/<link\b[^>]*href=["']([^"']+)["']/gi)) add(match[1]);
    return { method: "atom", urls: values.slice(0, limit) };
  }
  for (const match of input.body.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) add(match[1]);
  return {
    method: /application\/ld\+json/i.test(input.body) ? "json_ld" : "static_html",
    urls: values.slice(0, limit),
  };
}
