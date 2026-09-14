import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { assessSourceConfidence, assessSponsorship, decidePublication } from "@/server/confidence/model";
import {
  classifyFetchFailure,
  fetchRegisteredSource,
  redactOperationalError,
} from "@/server/ingestion/security";
import type { SourcePolicy } from "@/server/ingestion/types";
import {
  checkPublicationSafety,
  buildDailyQueryPlan,
  canonicalizeDiscoveryUrl,
  parseDiscoveryConfiguration,
  resolveRegisteredSource,
  type DiscoveryConfiguration,
} from "./model";
import { extractListingUrls, extractOpportunityFromHtml, extractOpportunityFromJson } from "./extraction";
import { BraveSearchProvider, SearchProviderError } from "./provider";
import type { AutonomousDiscoveryStore, DiscoveryStage, RegisteredSource, SearchProvider } from "./types";

export class DiscoveryUnavailableError extends Error {
  constructor(readonly state: "disabled" | "provider_disabled" | "quota_exhausted") {
    super(`Opportunity discovery is ${state.replaceAll("_", " ")}.`);
    this.name = "DiscoveryUnavailableError";
  }
}

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

function sourcePolicy(source: RegisteredSource): SourcePolicy {
  return {
    sourceId: source.id,
    sourceType: source.sourceType,
    discoveryMethod: source.sourceType === "search_provider" ? "search_provider" : "official_feed",
    adapterIdentifier: "phase15.native",
    adapterVersion: "phase15.v1",
    active: true,
    allowed: true,
    isFixture: false,
    robotsStatus: "allowed",
    termsStatus: "approved",
    allowedDomains: [...new Set([source.canonicalDomain, ...source.allowedDomains])],
    requestTimeoutMs: source.requestTimeoutMs,
    responseSizeLimitBytes: source.responseSizeLimitBytes,
    redirectLimit: source.redirectLimit,
    retryLimit: source.retryLimit,
    concurrencyLimit: source.concurrencyLimit,
  };
}

function retrievalMethod(contentType: string, body: string) {
  if (/application\/json/i.test(contentType)) return "api" as const;
  if (/<rss\b/i.test(body)) return "rss" as const;
  if (/<feed\b/i.test(body)) return "atom" as const;
  if (/<(?:urlset|sitemapindex)\b/i.test(body)) return "sitemap" as const;
  if (/application\/ld\+json/i.test(body)) return "json_ld" as const;
  return "static_html" as const;
}

export async function generateDiscoveryQueries(input: {
  store: AutonomousDiscoveryStore;
  config?: DiscoveryConfiguration;
  now?: Date;
}) {
  const config = input.config ?? parseDiscoveryConfiguration();
  if (!config.enabled) throw new DiscoveryUnavailableError("disabled");
  const now = input.now ?? new Date();
  const plan = buildDailyQueryPlan({ now, limit: config.dailyLimit });
  const scheduled = await input.store.saveQueries(plan, now.toISOString().slice(0, 10));
  return {
    status: "scheduled" as const,
    scheduled,
    countries: new Set(plan.map((query) => query.destinationCountryCode)).size,
    opportunityTypes: new Set(plan.map((query) => query.opportunityTypeCode)).size,
  };
}

export async function runWebDiscovery(input: {
  store: AutonomousDiscoveryStore;
  config?: DiscoveryConfiguration;
  provider?: SearchProvider;
  now?: Date;
  workerId?: string;
}) {
  const config = input.config ?? parseDiscoveryConfiguration();
  if (!config.enabled) throw new DiscoveryUnavailableError("disabled");
  if (!input.provider && !config.providerKey) throw new DiscoveryUnavailableError("provider_disabled");
  const provider = input.provider ?? new BraveSearchProvider(config.providerKey!);
  const workerId = input.workerId ?? randomUUID();
  const query = await input.store.nextQueuedQuery(workerId, 120);
  if (!query) return { status: "idle" as const, searches: 0, leads: 0, duplicates: 0 };
  let searchRunId: string | null = null;
  try {
    const quota = await input.store.consumeQuota(config.dailyLimit, config.monthlyLimit);
    if (!quota.allowed) {
      await input.store.failSearch(query.id, null, "quota_exhausted", false);
      throw new DiscoveryUnavailableError("quota_exhausted");
    }
    const now = input.now ?? new Date();
    searchRunId = await input.store.beginSearch(query.id, config.resultsPerQuery, now);
    const response = await provider.search(query.text, config.resultsPerQuery);
    const saved = await input.store.saveSearchResults({
      searchRunId,
      queryId: query.id,
      results: response.results,
      providerRequestId: response.providerRequestId,
      now,
    });
    await input.store.finishSearch(query.id, searchRunId, response.results.length, saved);
    return {
      status: response.results.length ? ("completed" as const) : ("zero_results" as const),
      searches: 1,
      leads: saved.created,
      duplicates: saved.duplicates,
      rejected: saved.rejected,
      quota: {
        dailyRemaining: quota.dailyRemaining,
        monthlyRemaining: quota.monthlyRemaining,
      },
    };
  } catch (error) {
    if (error instanceof DiscoveryUnavailableError) throw error;
    const code = error instanceof SearchProviderError ? error.code : "provider_failure";
    const retryable = error instanceof SearchProviderError ? error.retryable : true;
    await input.store.failSearch(query.id, searchRunId, code, retryable);
    throw error;
  }
}

export async function scheduleKnownSourceMonitoring(input: {
  store: AutonomousDiscoveryStore;
  config?: DiscoveryConfiguration;
  now?: Date;
  maxSources?: number;
}) {
  const config = input.config ?? parseDiscoveryConfiguration();
  if (!config.enabled) throw new DiscoveryUnavailableError("disabled");
  const now = input.now ?? new Date();
  const maxSources = Math.max(1, Math.min(8, input.maxSources ?? 4));
  const sources = (await input.store.listRegisteredSources())
    .filter(
      (source) =>
        source.official &&
        source.allowed &&
        !source.fixture &&
        source.robotsStatus === "allowed" &&
        source.termsStatus === "approved" &&
        source.sourceType !== "search_provider" &&
        (!source.nextEligibleRunAt || Date.parse(source.nextEligibleRunAt) <= now.getTime()),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, maxSources);
  let scheduled = 0;
  const bucket = now.toISOString().slice(0, 13);
  for (const source of sources) {
    const fingerprint = sha256(`direct:${source.id}:${source.baseUrl}:${bucket}`);
    if (
      await input.store.saveDirectSourceLead({
        sourceId: source.id,
        url: source.baseUrl,
        title: `Scheduled refresh for ${source.canonicalDomain}`,
        fingerprint,
      })
    )
      scheduled += 1;
  }
  return { status: "scheduled" as const, sources: sources.length, leads: scheduled, braveSearches: 0 };
}

export async function processDiscoveryLeads(input: {
  store: AutonomousDiscoveryStore;
  config?: DiscoveryConfiguration;
  workerId?: string;
  batchSize?: number;
  request?: typeof fetch;
}) {
  const config = input.config ?? parseDiscoveryConfiguration();
  if (!config.enabled) throw new DiscoveryUnavailableError("disabled");
  const workerId = input.workerId ?? randomUUID();
  const batchSize = Math.max(1, Math.min(10, input.batchSize ?? 4));
  const [sources, leads] = await Promise.all([
    input.store.listRegisteredSources(),
    input.store.claimLeads(workerId, batchSize, 240),
  ]);
  const totals = {
    processed: 0,
    published: 0,
    unresolved: 0,
    rejected: 0,
    retries: 0,
    matches: 0,
    notifications: 0,
    matchingFailures: 0,
    processingFailures: 0,
  };
  for (const lead of leads) {
    totals.processed += 1;
    const resolution = resolveRegisteredSource(lead.canonicalUrl, sources);
    const strength =
      resolution.status === "official"
        ? "official_opportunity"
        : resolution.status === "authoritative"
          ? "authoritative_registry"
          : resolution.status === "secondary"
            ? "approved_secondary"
            : "unverified_lead";
    await input.store.recordResolution({
      leadId: lead.id,
      candidateUrl: lead.canonicalUrl,
      resolvedUrl: resolution.source ? lead.canonicalUrl : undefined,
      sourceId: resolution.source?.id,
      sourceStrength: strength,
      status:
        resolution.status === "official"
          ? "resolved"
          : resolution.status === "blocked"
            ? "blocked"
            : "unresolved",
      reason: resolution.reason,
    });
    if (resolution.status !== "official" || !resolution.source) {
      const state = resolution.status === "blocked" ? "rejected" : "unresolved";
      await input.store.completeLead(lead.id, state, resolution.reason);
      totals[state] += 1;
      continue;
    }
    const source = resolution.source;
    let retrievalCompleted = false;
    try {
      const isBaseSourceRefresh =
        canonicalizeDiscoveryUrl(lead.canonicalUrl) === canonicalizeDiscoveryUrl(source.baseUrl);
      const retrieved = await fetchRegisteredSource({
        policy: sourcePolicy(source),
        url: lead.canonicalUrl,
        request: input.request,
        conditional: isBaseSourceRefresh
          ? { etag: source.lastEtag, lastModified: source.lastModified }
          : undefined,
      });
      if (retrieved.metadata.statusCode === 304) {
        await input.store.recordRetrieval({
          leadId: lead.id,
          sourceId: source.id,
          method: source.monitoringMethod === "api" ? "api" : "static_html",
          requestUrl: lead.canonicalUrl,
          finalUrl: retrieved.finalUrl,
          status: "not_modified",
          statusCode: 304,
          etag: retrieved.metadata.etag ?? source.lastEtag,
          lastModified: retrieved.metadata.lastModified ?? source.lastModified,
          byteLength: 0,
        });
        await input.store.updateSourceMonitorState(source.id, {
          etag: retrieved.metadata.etag ?? source.lastEtag,
          lastModified: retrieved.metadata.lastModified ?? source.lastModified,
        });
        await input.store.completeLead(lead.id, "unresolved", "source_not_modified");
        totals.unresolved += 1;
        continue;
      }
      const body = new TextDecoder("utf-8", { fatal: false }).decode(retrieved.body);
      const method = retrievalMethod(retrieved.metadata.contentType ?? "", body);
      const contentHash = sha256(retrieved.body);
      const unchanged = isBaseSourceRefresh && source.lastContentHash === contentHash;
      const retrievalId = await input.store.recordRetrieval({
        leadId: lead.id,
        sourceId: source.id,
        method,
        requestUrl: lead.canonicalUrl,
        finalUrl: retrieved.finalUrl,
        status: unchanged ? "not_modified" : "succeeded",
        statusCode: retrieved.metadata.statusCode,
        contentType: retrieved.metadata.contentType ?? undefined,
        contentHash,
        etag: retrieved.metadata.etag ?? undefined,
        lastModified: retrieved.metadata.lastModified ?? undefined,
        byteLength: retrieved.metadata.byteLength,
      });
      retrievalCompleted = true;
      if (isBaseSourceRefresh)
        await input.store.updateSourceMonitorState(source.id, {
          etag: retrieved.metadata.etag ?? undefined,
          lastModified: retrieved.metadata.lastModified ?? undefined,
          contentHash,
        });
      if (unchanged) {
        await input.store.completeLead(lead.id, "unresolved", "source_content_unchanged");
        totals.unresolved += 1;
        continue;
      }
      const structuredApi =
        method === "api" ? extractOpportunityFromJson({ body, sourceUrl: retrieved.finalUrl, source }) : null;
      if (["api", "rss", "atom", "sitemap"].includes(method) && !structuredApi?.candidate) {
        const listing = extractListingUrls({
          body,
          contentType: retrieved.metadata.contentType ?? "",
          baseUrl: retrieved.finalUrl,
          limit: 100,
        });
        let childLeads = 0;
        const bucket = new Date().toISOString().slice(0, 10);
        for (const url of listing.urls) {
          const fingerprint = sha256(`direct:${source.id}:${url}:${bucket}`);
          try {
            if (
              await input.store.saveDirectSourceLead({
                sourceId: source.id,
                url,
                title: `Listing from ${source.canonicalDomain}`,
                fingerprint,
              })
            )
              childLeads += 1;
          } catch {
            // An off-domain or malformed listing link cannot escape the registered source boundary.
          }
        }
        if (childLeads > 0) {
          await input.store.recordExtraction({
            leadId: lead.id,
            retrievalAttemptId: retrievalId,
            method: listing.method === "api" ? "structured_api" : "feed",
            status: "incomplete",
            explicitFacts: 0,
            unknownFacts: 1,
            evidenceFragments: 0,
            errorCode: "listing_expanded",
          });
          await input.store.completeLead(lead.id, "unresolved", "listing_expanded_to_internal_leads");
          totals.unresolved += 1;
          continue;
        }
      }
      const extraction = structuredApi?.candidate
        ? { method: "structured_api" as const, candidate: structuredApi.candidate, missing: [] }
        : extractOpportunityFromHtml({ html: body, sourceUrl: retrieved.finalUrl, source });
      if (!extraction.candidate) {
        await input.store.recordExtraction({
          leadId: lead.id,
          retrievalAttemptId: retrievalId,
          method: extraction.method,
          status: "incomplete",
          explicitFacts: 0,
          unknownFacts: extraction.missing.length,
          evidenceFragments: 0,
          errorCode: "incomplete_extraction",
        });
        await input.store.completeLead(lead.id, "unresolved", "incomplete_extraction");
        totals.unresolved += 1;
        continue;
      }
      const candidate = extraction.candidate;
      await input.store.recordExtraction({
        leadId: lead.id,
        retrievalAttemptId: retrievalId,
        method: extraction.method,
        status: "accepted",
        explicitFacts: Object.values(candidate).filter((value) => value !== undefined).length,
        unknownFacts: 0,
        evidenceFragments: candidate.evidence.length,
      });
      const sourceConfidence = assessSourceConfidence({
        trustTier: source.trustTier,
        hasPrimaryEvidence: true,
        fresh: true,
        canonicalDomainMatches: true,
        redirectConsistent: new URL(retrieved.finalUrl).hostname === new URL(candidate.canonicalUrl).hostname,
        evidenceSufficient: candidate.evidence.length > 0,
        contradictory: candidate.sponsorshipStatus === "conflicting",
        suspiciousPayment: false,
      });
      const sponsorship = assessSponsorship(
        candidate.sponsorshipStatus === "vacancy_evidence"
          ? [
              {
                scope: "vacancy_specific",
                kind: "sponsorship",
                trustTier: source.trustTier,
                active: true,
                stale: false,
                superseded: false,
              },
            ]
          : candidate.sponsorshipStatus === "visa_support"
            ? [
                {
                  scope: "vacancy_specific",
                  kind: "visa_support",
                  trustTier: source.trustTier,
                  active: true,
                  stale: false,
                  superseded: false,
                },
              ]
            : candidate.sponsorshipStatus === "excluded"
              ? [
                  {
                    scope: "vacancy_specific",
                    kind: "sponsorship_excluded",
                    trustTier: source.trustTier,
                    active: true,
                    stale: false,
                    superseded: false,
                  },
                ]
              : [],
      );
      const confidenceDecision = decidePublication({
        lifecycle: candidate.lifecycleStatus,
        evidenceSufficient: sourceConfidence.sufficient,
        contradiction: candidate.sponsorshipStatus === "conflicting",
        suspiciousPayment: false,
        repeatedFailureCount: 0,
        sponsorship,
      });
      const publication = checkPublicationSafety({
        type: candidate.opportunityTypeCode,
        title: candidate.title,
        organization: candidate.organizationName,
        destination: candidate.destinationCountryCode,
        isGlobal: candidate.isGlobal,
        sourceResolution: resolution,
        applicationUrl: candidate.applicationUrl,
        deadline: candidate.applicationDeadline,
        rolling: candidate.rollingDeadline,
        evidenceCount: candidate.evidence.length,
        lifecycle: candidate.lifecycleStatus,
        confidenceDecision,
        fixture: false,
        suspiciousPayment: false,
        contradictory: candidate.sponsorshipStatus === "conflicting",
      });
      if (!publication.allowed) {
        await input.store.completeLead(lead.id, "rejected", publication.reasons[0]);
        totals.rejected += 1;
        continue;
      }
      const published = await input.store.publishCandidate({
        leadId: lead.id,
        sourceId: source.id,
        candidate,
      });
      await input.store.completeLead(lead.id, "published");
      totals.published += 1;
      try {
        const downstream = await input.store.dispatchMatchingAndNotifications(published, candidate);
        totals.matches += downstream.matches;
        totals.notifications += downstream.notifications;
        totals.matchingFailures += downstream.failures ?? 0;
      } catch (error) {
        totals.matchingFailures += 1;
        void redactOperationalError(error);
      }
    } catch (error) {
      if (retrievalCompleted) {
        await input.store.completeLead(lead.id, "retry", "processing_failure");
        totals.retries += 1;
        totals.processingFailures += 1;
        void redactOperationalError(error);
        continue;
      }
      const retry = classifyFetchFailure(error, 1, source.retryLimit, 0);
      await input.store.recordRetrieval({
        leadId: lead.id,
        sourceId: source.id,
        method: source.monitoringMethod === "api" ? "api" : "static_html",
        requestUrl: lead.canonicalUrl,
        status:
          retry.classification === "timeout"
            ? "timeout"
            : retry.classification === "rate_limited"
              ? "rate_limited"
              : retry.classification === "policy_blocked"
                ? "blocked"
                : "failed",
        errorCode: retry.classification,
      });
      await input.store.completeLead(lead.id, retry.retryable ? "retry" : "rejected", retry.classification);
      if (retry.retryable) totals.retries += 1;
      else totals.rejected += 1;
      void redactOperationalError(error);
    }
  }
  return { status: leads.length ? ("completed" as const) : ("idle" as const), ...totals };
}

export async function runDiscoveryStage(input: {
  stage: DiscoveryStage;
  store: AutonomousDiscoveryStore;
  config?: DiscoveryConfiguration;
}) {
  if (input.stage === "query_generation") return generateDiscoveryQueries(input);
  if (input.stage === "web_discovery") return runWebDiscovery(input);
  if (input.stage === "known_source_monitoring") return scheduleKnownSourceMonitoring(input);
  return processDiscoveryLeads(input);
}
