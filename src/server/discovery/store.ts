import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json, Database } from "@/server/supabase/database.types";
import {
  matchInputFingerprint,
  MATCH_ALGORITHM_VERSION,
  SCORING_CONFIGURATION_VERSION,
} from "@/server/matching/model";
import { persistMatchEvaluation } from "@/server/matching/service";
import { enqueueNotificationEvent } from "@/server/notifications/service";
import { prepareDuplicateKey } from "@/server/opportunities/model";
import { canonicalizeDiscoveryUrl } from "./model";
import type {
  AutonomousDiscoveryStore,
  ClaimedLead,
  DiscoveryQuery,
  DiscoveredOpportunity,
  PublishedOpportunity,
  QuotaConsumption,
  RegisteredSource,
  SearchResult,
} from "./types";

type DbError = { code?: string; message?: string };
type DbResult<T> = { data: T | null; error: DbError | null; count?: number | null };
interface Query<T = unknown> extends PromiseLike<DbResult<T>> {
  select(columns?: string, options?: { count?: "exact"; head?: boolean }): Query<T>;
  eq(column: string, value: unknown): Query<T>;
  in(column: string, values: readonly unknown[]): Query<T>;
  order(column: string, options?: { ascending?: boolean }): Query<T>;
  limit(value: number): Query<T>;
  single(): Query<T>;
  maybeSingle(): Query<T>;
}
interface Table {
  select(columns?: string, options?: { count?: "exact"; head?: boolean }): Query;
  insert(value: unknown): Query;
  upsert(value: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }): Query;
  update(value: unknown): Query;
}
type RawDatabase = {
  from(table: string): Table;
  rpc(functionName: string, args?: Record<string, unknown>): Query;
};

type QuotaRow = {
  allowed: boolean;
  daily_used: number;
  monthly_used: number;
  daily_remaining: number;
  monthly_remaining: number;
};
type ClaimedQueryRow = { id: string; query_text: string; query_fingerprint: string };
type ClaimedLeadRow = {
  id: string;
  canonical_url: string;
  result_url: string;
  result_domain: string;
  result_title: string;
};
type PublishedRow = {
  opportunity_id: string;
  opportunity_version_id: string;
  confidence_assessment_id: string;
  created: boolean;
};

const providerDataErrorCodes = new Set(["22021", "22P05", "23514", "P0001"]);

const assertResult = <T>(result: DbResult<T>, message: string): T => {
  if (result.error || result.data === null) throw new Error(message);
  return result.data;
};
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const utcDate = (date: Date) => date.toISOString().slice(0, 10);
const utcMonth = (date: Date) => `${date.toISOString().slice(0, 7)}-01`;

export class SupabaseDiscoveryStore implements AutonomousDiscoveryStore {
  private readonly raw: RawDatabase;

  constructor(private readonly client: SupabaseClient<Database>) {
    this.raw = client as unknown as RawDatabase;
  }

  async saveQueries(queries: DiscoveryQuery[], scheduledFor: string): Promise<number> {
    if (!queries.length) return 0;
    const templatesResult = (await this.raw
      .from("opportunity_query_templates")
      .select("id,template_key")
      .in(
        "template_key",
        queries.map((query) => query.templateKey),
      )) as DbResult<Array<{ id: string; template_key: string }>>;
    const templates = assertResult(templatesResult, "Discovery query templates are unavailable");
    const ids = new Map(templates.map((row) => [row.template_key, row.id]));
    if (queries.some((query) => !ids.has(query.templateKey)))
      throw new Error("Discovery query template coverage is incomplete");
    const result = (await this.raw
      .from("opportunity_generated_queries")
      .upsert(
        queries.map((query) => ({
          template_id: ids.get(query.templateKey),
          provider: "brave",
          query_text: query.text,
          query_fingerprint: query.fingerprint,
          scheduled_for: scheduledFor,
          status: "queued",
        })),
        { onConflict: "query_fingerprint,scheduled_for", ignoreDuplicates: true },
      )
      .select("id")) as DbResult<Array<{ id: string }>>;
    if (result.error) throw new Error("Discovery queries could not be scheduled");
    return result.data?.length ?? 0;
  }

  async consumeQuota(dailyLimit: number, monthlyLimit: number): Promise<QuotaConsumption> {
    const result = (await this.raw.rpc("phase15_consume_search_quota", {
      candidate_provider: "brave",
      candidate_daily_limit: dailyLimit,
      candidate_monthly_limit: monthlyLimit,
      requested_calls: 1,
    })) as DbResult<QuotaRow[]>;
    const row = assertResult(result, "Search quota state is unavailable")[0];
    if (!row) throw new Error("Search quota state is unavailable");
    return {
      allowed: row.allowed,
      dailyUsed: row.daily_used,
      monthlyUsed: row.monthly_used,
      dailyRemaining: row.daily_remaining,
      monthlyRemaining: row.monthly_remaining,
    };
  }

  async nextQueuedQuery(workerId: string, leaseSeconds: number) {
    const result = (await this.raw.rpc("phase15_claim_generated_query", {
      candidate_worker: workerId,
      lease_seconds: leaseSeconds,
    })) as DbResult<ClaimedQueryRow[]>;
    const row = assertResult(result, "Discovery query could not be claimed")[0];
    return row ? { id: row.id, text: row.query_text, fingerprint: row.query_fingerprint } : null;
  }

  async beginSearch(queryId: string, resultCount: number, now: Date): Promise<string> {
    const result = (await this.raw
      .from("opportunity_search_runs")
      .insert({
        query_id: queryId,
        provider: "brave",
        requested_result_count: resultCount,
        quota_day: utcDate(now),
        quota_month: utcMonth(now),
      })
      .select("id")
      .single()) as DbResult<{ id: string }>;
    return assertResult(result, "Search run could not be recorded").id;
  }

  async saveSearchResults(input: {
    searchRunId: string;
    queryId: string;
    results: SearchResult[];
    providerRequestId?: string;
    now: Date;
  }): Promise<{ created: number; duplicates: number; rejected: number }> {
    let created = 0;
    let rejected = 0;
    for (const result of input.results) {
      const canonicalUrl = canonicalizeDiscoveryUrl(result.url);
      const domain = new URL(canonicalUrl).hostname;
      const fingerprint = sha256(`brave:${canonicalUrl}`);
      const saved = (await this.raw.rpc("phase15_record_discovery_lead", {
        candidate_search_run: input.searchRunId,
        candidate_query: input.queryId,
        candidate_result_url: result.url,
        candidate_canonical_url: canonicalUrl,
        candidate_domain: domain,
        candidate_title: result.title,
        candidate_snippet: result.snippet,
        candidate_position: result.position,
        candidate_language: result.language ?? null,
        candidate_provider_result_id: result.providerResultId ?? null,
        candidate_fingerprint: fingerprint,
      })) as DbResult<Array<{ lead_id: string; created: boolean }>>;
      if (saved.error) {
        if (saved.error.code && providerDataErrorCodes.has(saved.error.code)) {
          rejected += 1;
          continue;
        }
        throw new Error("Discovery result could not be stored");
      }
      if (saved.data?.[0]?.created) created += 1;
    }
    const update = (await this.raw
      .from("opportunity_search_runs")
      .update({ provider_request_id: input.providerRequestId ?? null })
      .eq("id", input.searchRunId)) as DbResult<unknown>;
    if (update.error) throw new Error("Search trace could not be updated");
    return { created, duplicates: input.results.length - created - rejected, rejected };
  }

  async failSearch(queryId: string, searchRunId: string | null, code: string, retryable: boolean) {
    if (searchRunId) {
      const run = (await this.raw
        .from("opportunity_search_runs")
        .update({
          state:
            code === "rate_limited"
              ? "rate_limited"
              : code === "quota_exhausted"
                ? "quota_exhausted"
                : "failed",
          safe_error_code: code,
          finished_at: new Date().toISOString(),
        })
        .eq("id", searchRunId)) as DbResult<unknown>;
      if (run.error) throw new Error("Search failure could not be recorded");
    }
    const query = (await this.raw
      .from("opportunity_generated_queries")
      .update({
        status: retryable ? "retry" : "failed",
        safe_error_code: code,
        next_attempt_at: retryable
          ? new Date(Date.now() + 15 * 60_000).toISOString()
          : new Date().toISOString(),
        lease_owner: null,
        lease_expires_at: null,
        finished_at: retryable ? null : new Date().toISOString(),
      })
      .eq("id", queryId)) as DbResult<unknown>;
    if (query.error) throw new Error("Discovery query failure could not be recorded");
  }

  async finishSearch(
    queryId: string,
    searchRunId: string,
    resultCount: number,
    metrics?: { created: number; duplicates: number; rejected: number },
  ): Promise<void> {
    const state = resultCount ? "succeeded" : "zero_results";
    const now = new Date().toISOString();
    const [run, query] = (await Promise.all([
      this.raw
        .from("opportunity_search_runs")
        .update({ state, returned_result_count: resultCount, finished_at: now })
        .eq("id", searchRunId),
      this.raw
        .from("opportunity_generated_queries")
        .update({
          status: state,
          result_count: resultCount,
          useful_result_count: metrics?.created ?? 0,
          duplicate_result_count: metrics?.duplicates ?? 0,
          rejected_result_count: metrics?.rejected ?? 0,
          finished_at: now,
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", queryId),
    ])) as [DbResult<unknown>, DbResult<unknown>];
    if (run.error || query.error) throw new Error("Search completion could not be recorded");
  }

  async listRegisteredSources(): Promise<RegisteredSource[]> {
    const result = (await this.raw
      .from("source_registry")
      .select(
        "id,base_url,canonical_domain,allowed_domains,source_type,trust_tier,is_official_source,is_allowed,active,is_fixture,robots_policy_status,terms_review_status,request_timeout_ms,response_size_limit_bytes,redirect_limit,retry_limit,concurrency_limit,monitoring_method,refresh_frequency_hours,next_eligible_run_at,last_etag,last_modified_header,last_content_hash",
      )
      .eq("active", true)) as DbResult<
      Array<{
        id: string;
        base_url: string;
        canonical_domain: string;
        allowed_domains: string[];
        source_type: RegisteredSource["sourceType"];
        trust_tier: number;
        is_official_source: boolean;
        is_allowed: boolean;
        active: boolean;
        is_fixture: boolean;
        robots_policy_status: RegisteredSource["robotsStatus"];
        terms_review_status: RegisteredSource["termsStatus"];
        request_timeout_ms: number;
        response_size_limit_bytes: number;
        redirect_limit: number;
        retry_limit: number;
        concurrency_limit: number;
        monitoring_method: RegisteredSource["monitoringMethod"] | null;
        refresh_frequency_hours: number | null;
        next_eligible_run_at: string | null;
        last_etag: string | null;
        last_modified_header: string | null;
        last_content_hash: string | null;
      }>
    >;
    return assertResult(result, "Source registry is unavailable").map((row) => ({
      id: row.id,
      baseUrl: row.base_url,
      canonicalDomain: row.canonical_domain,
      allowedDomains: row.allowed_domains,
      sourceType: row.source_type,
      trustTier: row.trust_tier,
      official: row.is_official_source,
      allowed: row.is_allowed,
      active: row.active,
      fixture: row.is_fixture,
      robotsStatus: row.robots_policy_status,
      termsStatus: row.terms_review_status,
      requestTimeoutMs: row.request_timeout_ms,
      responseSizeLimitBytes: row.response_size_limit_bytes,
      redirectLimit: row.redirect_limit,
      retryLimit: row.retry_limit,
      concurrencyLimit: row.concurrency_limit,
      monitoringMethod: row.monitoring_method ?? undefined,
      refreshFrequencyHours: row.refresh_frequency_hours ?? undefined,
      nextEligibleRunAt: row.next_eligible_run_at ?? undefined,
      lastEtag: row.last_etag ?? undefined,
      lastModified: row.last_modified_header ?? undefined,
      lastContentHash: row.last_content_hash ?? undefined,
    }));
  }

  async claimLeads(workerId: string, batchSize: number, leaseSeconds: number): Promise<ClaimedLead[]> {
    const result = (await this.raw.rpc("phase15_claim_discovery_lead", {
      candidate_worker: workerId,
      candidate_batch_size: batchSize,
      lease_seconds: leaseSeconds,
    })) as DbResult<ClaimedLeadRow[]>;
    return assertResult(result, "Discovery leads could not be claimed").map((row) => ({
      id: row.id,
      canonicalUrl: row.canonical_url,
      resultUrl: row.result_url,
      resultDomain: row.result_domain,
      resultTitle: row.result_title,
    }));
  }

  async recordResolution(input: {
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
  }) {
    const result = (await this.raw.from("opportunity_source_resolution_attempts").insert({
      lead_id: input.leadId,
      candidate_url: input.candidateUrl,
      resolved_url: input.resolvedUrl ?? null,
      resolved_source_id: input.sourceId ?? null,
      source_strength: input.sourceStrength,
      status: input.status,
      safe_reason: input.reason ?? null,
    })) as DbResult<unknown>;
    if (result.error) throw new Error("Source resolution could not be recorded");
  }

  async recordRetrieval(input: {
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
  }): Promise<string> {
    const result = (await this.raw
      .from("opportunity_retrieval_attempts")
      .insert({
        lead_id: input.leadId,
        source_id: input.sourceId,
        retrieval_method: input.method,
        request_url: input.requestUrl,
        final_url: input.finalUrl ?? null,
        status: input.status,
        status_code: input.statusCode ?? null,
        content_type: input.contentType ?? null,
        content_hash: input.contentHash ?? null,
        etag: input.etag ?? null,
        last_modified: input.lastModified ?? null,
        byte_length: input.byteLength ?? null,
        safe_error_code: input.errorCode ?? null,
      })
      .select("id")
      .single()) as DbResult<{ id: string }>;
    return assertResult(result, "Retrieval attempt could not be recorded").id;
  }

  async recordExtraction(input: {
    leadId: string;
    retrievalAttemptId?: string;
    method: "source_adapter" | "structured_api" | "feed" | "json_ld" | "generic_html" | "bounded_ai";
    status: "accepted" | "incomplete" | "malformed" | "conflicting" | "rejected";
    explicitFacts: number;
    unknownFacts: number;
    evidenceFragments: number;
    errorCode?: string;
  }) {
    const result = (await this.raw.from("opportunity_extraction_attempts").insert({
      lead_id: input.leadId,
      retrieval_attempt_id: input.retrievalAttemptId ?? null,
      extraction_method: input.method,
      schema_version: "phase15.v1",
      status: input.status,
      explicit_fact_count: input.explicitFacts,
      unknown_fact_count: input.unknownFacts,
      evidence_fragment_count: input.evidenceFragments,
      safe_error_code: input.errorCode ?? null,
    })) as DbResult<unknown>;
    if (result.error) throw new Error("Extraction attempt could not be recorded");
  }

  async updateSourceMonitorState(
    sourceId: string,
    state: { etag?: string; lastModified?: string; contentHash?: string },
  ) {
    const update: Record<string, string> = { last_monitor_success_at: new Date().toISOString() };
    if (state.etag !== undefined) update.last_etag = state.etag;
    if (state.lastModified !== undefined) update.last_modified_header = state.lastModified;
    if (state.contentHash !== undefined) update.last_content_hash = state.contentHash;
    const result = (await this.raw
      .from("source_registry")
      .update(update)
      .eq("id", sourceId)) as DbResult<unknown>;
    if (result.error) throw new Error("Source monitor state could not be recorded");
  }

  async completeLead(
    leadId: string,
    status: "unresolved" | "published" | "rejected" | "retry" | "dead_letter",
    reason?: string,
  ) {
    let finalStatus = status;
    let retryCount = 0;
    if (status === "retry") {
      const current = (await this.raw
        .from("opportunity_discovery_leads")
        .select("retry_count")
        .eq("id", leadId)
        .maybeSingle()) as DbResult<{ retry_count: number }>;
      if (current.error || !current.data) throw new Error("Discovery lead retry state could not be read");
      retryCount = Math.min(6, current.data.retry_count + 1);
      if (retryCount >= 6) finalStatus = "dead_letter";
    }
    const result = (await this.raw
      .from("opportunity_discovery_leads")
      .update({
        processing_status: finalStatus,
        safe_rejection_reason: reason ?? null,
        retry_count: retryCount,
        next_retry_at:
          finalStatus === "retry"
            ? new Date(Date.now() + Math.min(24, 2 ** retryCount) * 30 * 60_000).toISOString()
            : null,
        lease_owner: null,
        lease_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)) as DbResult<unknown>;
    if (result.error) throw new Error("Discovery lead could not be completed");
  }

  async publishCandidate(input: {
    leadId: string;
    sourceId: string;
    candidate: DiscoveredOpportunity;
  }): Promise<PublishedOpportunity> {
    const duplicateKey = prepareDuplicateKey({
      canonicalUrl: input.candidate.canonicalUrl,
      normalizedOrganization: input.candidate.organizationName.toLowerCase(),
      normalizedTitle: input.candidate.normalizedTitle,
      destinationCountryCode: input.candidate.destinationCountryCode,
      opportunityTypeCode: input.candidate.opportunityTypeCode,
      externalSourceId: input.candidate.externalSourceId,
    });
    const decisionFingerprint = sha256(`${input.leadId}:${input.candidate.contentHash}:${duplicateKey}`);
    const result = (await this.raw.rpc("phase15_publish_candidate", {
      candidate_lead: input.leadId,
      candidate_source: input.sourceId,
      candidate_type_code: input.candidate.opportunityTypeCode,
      candidate_title: input.candidate.title,
      candidate_normalized_title: input.candidate.normalizedTitle,
      candidate_organization: input.candidate.organizationName,
      candidate_destination_code: input.candidate.destinationCountryCode ?? null,
      candidate_is_global: input.candidate.isGlobal,
      candidate_summary: input.candidate.summary ?? null,
      candidate_canonical_url: input.candidate.canonicalUrl,
      candidate_application_url: input.candidate.applicationUrl,
      candidate_deadline: input.candidate.applicationDeadline ?? null,
      candidate_rolling: input.candidate.rollingDeadline,
      candidate_funding: input.candidate.fundingCoverage,
      candidate_sponsorship: input.candidate.sponsorshipStatus,
      candidate_content_hash: input.candidate.contentHash,
      candidate_duplicate_key: duplicateKey,
      candidate_evidence_excerpt: input.candidate.evidence[0].excerpt,
      candidate_decision_fingerprint: decisionFingerprint,
    })) as DbResult<PublishedRow[]>;
    const row = assertResult(result, "Validated opportunity could not pass the publication gate")[0];
    if (!row) throw new Error("Validated opportunity could not pass the publication gate");
    return {
      opportunityId: row.opportunity_id,
      opportunityVersionId: row.opportunity_version_id,
      confidenceAssessmentId: row.confidence_assessment_id,
      created: row.created,
    };
  }

  async dispatchMatchingAndNotifications(
    published: PublishedOpportunity,
    candidate: DiscoveredOpportunity,
  ): Promise<{ matches: number; notifications: number }> {
    const profiles = await this.client
      .from("profile_versions")
      .select("id,user_id,version_number,snapshot")
      .order("version_number", { ascending: false })
      .limit(5000);
    if (profiles.error) throw new Error("Confirmed Passport snapshots could not be loaded");
    const latest = new Map<string, (typeof profiles.data)[number]>();
    for (const profile of profiles.data)
      if (!latest.has(profile.user_id)) latest.set(profile.user_id, profile);
    const goalsByType: Record<DiscoveredOpportunity["opportunityTypeCode"], string[]> = {
      scholarship: ["study_funding"],
      fellowship: ["fellowship_graduate", "research"],
      graduate_programme: ["fellowship_graduate", "professional_sponsorship"],
      research_position: ["research"],
      internship: ["internship"],
      professional_job: ["professional_sponsorship"],
      skilled_trade_work: ["skilled_trade"],
    };
    let matches = 0;
    let notifications = 0;
    for (const profile of latest.values()) {
      const snapshot =
        profile.snapshot && typeof profile.snapshot === "object" && !Array.isArray(profile.snapshot)
          ? (profile.snapshot as Record<string, Json | undefined>)
          : {};
      const goals = Array.isArray(snapshot.selectedGoals)
        ? snapshot.selectedGoals.filter((value): value is string => typeof value === "string")
        : [];
      const destinations = Array.isArray(snapshot.destinations)
        ? snapshot.destinations.filter((value): value is string => typeof value === "string")
        : [];
      if (!goalsByType[candidate.opportunityTypeCode].some((goal) => goals.includes(goal))) continue;
      if (
        candidate.destinationCountryCode &&
        destinations.length &&
        !destinations.includes(candidate.destinationCountryCode)
      )
        continue;
      const destinationAligned =
        !candidate.destinationCountryCode ||
        !destinations.length ||
        destinations.includes(candidate.destinationCountryCode);
      const score = destinationAligned ? 85 : 70;
      const inputFingerprint = matchInputFingerprint({
        profileVersionId: profile.id,
        opportunityVersionId: published.opportunityVersionId,
        type: candidate.opportunityTypeCode,
        destination: candidate.destinationCountryCode ?? "global",
        contentHash: candidate.contentHash,
      });
      const persisted = await persistMatchEvaluation(this.client, {
        userId: profile.user_id,
        profileVersionId: profile.id,
        opportunityId: published.opportunityId,
        opportunityVersionId: published.opportunityVersionId,
        confidenceAssessmentId: published.confidenceAssessmentId,
        algorithmVersion: `${MATCH_ALGORITHM_VERSION}.phase15`,
        scoringConfigurationVersion: SCORING_CONFIGURATION_VERSION,
        inputFingerprint,
        candidateRank: 1,
        eligibilityOutcome: "more_information_needed",
        publicationDecision: candidate.sponsorshipStatus === "conflicting" ? "more_evidence" : "limited",
        matchScore: score,
        readinessState: "unknown",
        selectionFactors: {
          goal_alignment: true,
          destination_alignment: destinationAligned,
          deterministic: true,
        },
      });
      if (!persisted.created) continue;
      matches += 1;
      await enqueueNotificationEvent(
        {
          userId: profile.user_id,
          eventType: score >= 80 ? "strong_match" : "new_match",
          resourceKind: "opportunity",
          resourceId: published.opportunityId,
          occurrenceKey: `phase15:${published.opportunityVersionId}`,
          occurredAt: new Date(),
          safeContext: { urgency: "routine" },
        },
        this.client,
      );
      notifications += 1;
    }
    return { matches, notifications };
  }

  async saveDirectSourceLead(input: {
    sourceId: string;
    url: string;
    title: string;
    fingerprint: string;
  }): Promise<boolean> {
    const result = (await this.raw.rpc("phase15_record_direct_source_lead", {
      candidate_source: input.sourceId,
      candidate_url: input.url,
      candidate_title: input.title,
      candidate_fingerprint: input.fingerprint,
    })) as DbResult<Array<{ lead_id: string; created: boolean }>>;
    if (result.error) throw new Error("Direct source lead could not be scheduled");
    return result.data?.[0]?.created ?? false;
  }
}
