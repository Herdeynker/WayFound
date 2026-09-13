import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { afterAll, describe, expect, it } from "vitest";
import { processDiscoveryLeads } from "@/server/discovery/service";
import type {
  AutonomousDiscoveryStore,
  ClaimedLead,
  DiscoveredOpportunity,
  PublishedOpportunity,
  RegisteredSource,
} from "@/server/discovery/types";

loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(url && publicKey && secretKey);
const hostedCase = live ? it : it.skip;
const admin = live
  ? createClient(url!, secretKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

type DbResult<T> = { data: T | null; error: { code?: string } | null };
interface Query<T = unknown> extends PromiseLike<DbResult<T>> {
  select(columns?: string): Query<T>;
  eq(column: string, value: unknown): Query<T>;
  in(column: string, values: readonly unknown[]): Query<T>;
  order(column: string, options?: { ascending?: boolean }): Query<T>;
  limit(count: number): Query<T>;
  single(): Query<T>;
  maybeSingle(): Query<T>;
}
interface RawTable {
  select(columns?: string): Query;
  insert(value: unknown): Query;
  update(value: unknown): Query;
  delete(): Query;
}
type RawClient = { from(name: string): RawTable; rpc(name: string, args: Record<string, unknown>): Query };
const rawAdmin = admin as unknown as RawClient | null;

const source: RegisteredSource = {
  id: "11111111-1111-4111-8111-111111111111",
  baseUrl: "https://official.example.test/",
  canonicalDomain: "official.example.test",
  allowedDomains: ["official.example.test"],
  sourceType: "official_scholarship_body",
  trustTier: 1,
  official: true,
  allowed: true,
  active: true,
  fixture: false,
  robotsStatus: "allowed",
  termsStatus: "approved",
  requestTimeoutMs: 5000,
  responseSizeLimitBytes: 1_048_576,
  redirectLimit: 2,
  retryLimit: 1,
  concurrencyLimit: 1,
  monitoringMethod: "json_ld",
  refreshFrequencyHours: 24,
};

class EndToEndStore implements AutonomousDiscoveryStore {
  readonly lead: ClaimedLead = {
    id: "22222222-2222-4222-8222-222222222222",
    canonicalUrl: "https://official.example.test/scholarships/1",
    resultUrl: "https://official.example.test/scholarships/1",
    resultDomain: "official.example.test",
    resultTitle: "Global scholarship",
  };
  candidate?: DiscoveredOpportunity;
  statuses: string[] = [];
  resolutionCount = 0;
  retrievalCount = 0;
  extractionCount = 0;
  async saveQueries() {
    return 0;
  }
  async consumeQuota() {
    return { allowed: true, dailyUsed: 1, monthlyUsed: 1, dailyRemaining: 24, monthlyRemaining: 749 };
  }
  async nextQueuedQuery() {
    return null;
  }
  async beginSearch() {
    return crypto.randomUUID();
  }
  async saveSearchResults() {
    return { created: 0, duplicates: 0, rejected: 0 };
  }
  async failSearch() {}
  async finishSearch() {}
  async listRegisteredSources() {
    return [source];
  }
  async claimLeads() {
    return [this.lead];
  }
  async recordResolution() {
    this.resolutionCount += 1;
  }
  async recordRetrieval() {
    this.retrievalCount += 1;
    return crypto.randomUUID();
  }
  async recordExtraction() {
    this.extractionCount += 1;
  }
  async updateSourceMonitorState() {}
  async completeLead(_id: string, status: string) {
    this.statuses.push(status);
  }
  async publishCandidate(input: { candidate: DiscoveredOpportunity }): Promise<PublishedOpportunity> {
    this.candidate = input.candidate;
    return {
      opportunityId: "33333333-3333-4333-8333-333333333333",
      opportunityVersionId: "44444444-4444-4444-8444-444444444444",
      confidenceAssessmentId: "55555555-5555-4555-8555-555555555555",
      created: true,
    };
  }
  async dispatchMatchingAndNotifications() {
    return { matches: 2, notifications: 1 };
  }
  async saveDirectSourceLead() {
    return true;
  }
}

describe("Phase 15 deterministic end-to-end discovery", () => {
  it("moves an official result through retrieval, evidence, confidence, publication, matching and notification", async () => {
    const store = new EndToEndStore();
    const html = `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify({
      "@type": "EducationalOccupationalProgram",
      name: "China Global Scholarship",
      description: "A fully funded scholarship in China for international applicants.",
      validThrough: "2099-12-31",
      url: store.lead.canonicalUrl,
      provider: { name: "Official Scholarship Council" },
    })}</script></head><body><h1>China Global Scholarship</h1></body></html>`;
    const result = await processDiscoveryLeads({
      store,
      config: {
        enabled: true,
        provider: "brave",
        dailyLimit: 25,
        monthlyLimit: 750,
        resultsPerQuery: 20,
        paidOverageAllowed: false,
        status: "provider_disabled",
      },
      request: async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
    });
    expect(result).toMatchObject({ processed: 1, published: 1, matches: 2, notifications: 1 });
    expect(store.resolutionCount).toBe(1);
    expect(store.retrievalCount).toBe(1);
    expect(store.extractionCount).toBe(1);
    expect(store.statuses).toContain("published");
    expect(store.candidate).toMatchObject({
      opportunityTypeCode: "scholarship",
      destinationCountryCode: "CN",
    });
  });
});

const cleanup = {
  users: [] as string[],
  sourceIds: [] as string[],
  leadIds: [] as string[],
  queryIds: [] as string[],
  searchIds: [] as string[],
  opportunityIds: [] as string[],
  organizationNames: [] as string[],
  domains: [] as string[],
  jobIds: [] as string[],
};

describe("Phase 15 hosted schema and RLS", () => {
  afterAll(async () => {
    if (!rawAdmin || !admin) return;
    for (const user of cleanup.users) await admin.auth.admin.deleteUser(user);
    for (const id of cleanup.opportunityIds) await rawAdmin.from("opportunities").delete().eq("id", id);
    for (const id of cleanup.leadIds)
      await rawAdmin.from("opportunity_discovery_leads").delete().eq("id", id);
    for (const id of cleanup.searchIds) await rawAdmin.from("opportunity_search_runs").delete().eq("id", id);
    for (const id of cleanup.queryIds)
      await rawAdmin.from("opportunity_generated_queries").delete().eq("id", id);
    for (const id of cleanup.jobIds) await rawAdmin.from("opportunity_discovery_jobs").delete().eq("id", id);
    for (const id of cleanup.sourceIds) await rawAdmin.from("source_registry").delete().eq("id", id);
    for (const domain of cleanup.domains)
      await rawAdmin.from("opportunity_domain_discovery_status").delete().eq("domain", domain);
    for (const name of cleanup.organizationNames)
      await rawAdmin.from("organizations").delete().eq("normalized_name", name);
  }, 60_000);

  hostedCase(
    "enforces atomic quota and non-overlapping worker leases under concurrency",
    async () => {
      if (!rawAdmin) throw new Error("Hosted client unavailable");
      const current = new Date();
      const dayStart = `${current.toISOString().slice(0, 10)}T00:00:00+00:00`;
      const monthStart = `${current.toISOString().slice(0, 7)}-01T00:00:00+00:00`;
      type UsageRow = {
        id: string;
        window_kind: string;
        hard_limit: number;
        request_count: number;
        estimated_cost_microusd: number;
      };
      const before = (await rawAdmin
        .from("opportunity_provider_usage_windows")
        .select("id,window_kind,hard_limit,request_count,estimated_cost_microusd")
        .in("window_start", [dayStart, monthStart])) as DbResult<UsageRow[]>;
      expect(before.error).toBeNull();
      try {
        for (const row of before.data ?? []) {
          expect(
            (
              await rawAdmin
                .from("opportunity_provider_usage_windows")
                .update({
                  hard_limit: row.window_kind === "utc_day" ? 5 : 7,
                  request_count: 0,
                  estimated_cost_microusd: 0,
                })
                .eq("id", row.id)
            ).error,
          ).toBeNull();
        }
        const attempts = await Promise.all(
          Array.from({ length: 12 }, () =>
            rawAdmin.rpc("phase15_consume_search_quota", {
              candidate_provider: "brave",
              candidate_daily_limit: 5,
              candidate_monthly_limit: 7,
              requested_calls: 1,
            }),
          ),
        );
        expect(attempts.every((result) => !result.error)).toBe(true);
        const allowed = attempts.flatMap((result) =>
          ((result.data ?? []) as Array<{ allowed: boolean }>).filter((row) => row.allowed),
        );
        expect(allowed).toHaveLength(5);
      } finally {
        const after = (await rawAdmin
          .from("opportunity_provider_usage_windows")
          .select("id,window_kind,window_start")
          .in("window_start", [dayStart, monthStart])) as DbResult<
          Array<{ id: string; window_kind: string; window_start: string }>
        >;
        const prior = new Map((before.data ?? []).map((row) => [row.window_kind, row]));
        for (const row of after.data ?? []) {
          const original = prior.get(row.window_kind);
          if (original) {
            await rawAdmin
              .from("opportunity_provider_usage_windows")
              .update({
                hard_limit: original.hard_limit,
                request_count: original.request_count,
                estimated_cost_microusd: original.estimated_cost_microusd,
              })
              .eq("id", row.id);
          } else {
            await rawAdmin.from("opportunity_provider_usage_windows").delete().eq("id", row.id);
          }
        }
      }

      const job = (await rawAdmin
        .from("opportunity_discovery_jobs")
        .insert({
          stage: "cleanup",
          idempotency_key: `phase15.lease.${crypto.randomUUID()}`,
          payload: {},
        })
        .select("id")
        .single()) as DbResult<{ id: string }>;
      expect(job.error).toBeNull();
      cleanup.jobIds.push(job.data!.id);
      const claims = await Promise.all(
        [crypto.randomUUID(), crypto.randomUUID()].map((worker) =>
          rawAdmin.rpc("phase15_claim_discovery_jobs", {
            candidate_stage: "cleanup",
            candidate_worker: worker,
            candidate_batch_size: 1,
            lease_seconds: 60,
          }),
        ),
      );
      const claimedIds = claims.flatMap((result) =>
        ((result.data ?? []) as Array<{ id: string }>).map((row) => row.id),
      );
      expect(claimedIds.filter((id) => id === job.data!.id)).toHaveLength(1);
    },
    90_000,
  );

  hostedCase(
    "keeps leads and workers service-only while safely publishing verified official evidence",
    async () => {
      if (!rawAdmin || !admin) throw new Error("Hosted client unavailable");
      const templates = (await rawAdmin
        .from("opportunity_query_templates")
        .select("id,template_key")) as DbResult<Array<{ id: string; template_key: string }>>;
      expect(templates.error).toBeNull();
      expect(templates.data).toHaveLength(63);
      const suffix = crypto.randomUUID().slice(0, 8);
      const domain = `phase15-${suffix}.example.test`;
      cleanup.domains.push(domain);
      const sourceInsert = (await rawAdmin
        .from("source_registry")
        .insert({
          source_name: `Phase 15 ${suffix}`,
          source_type: "official_scholarship_body",
          base_url: `https://${domain}/`,
          canonical_domain: domain,
          trust_tier: 1,
          is_official_source: true,
          is_allowed: true,
          discovery_method: "official_feed",
          refresh_frequency_hours: 24,
          robots_policy_status: "allowed",
          terms_review_status: "approved",
          active: true,
          is_fixture: false,
          allowed_domains: [domain],
          adapter_identifier: "phase15.test",
          adapter_version: "phase15.v1",
          monitoring_method: "json_ld",
        })
        .select("id")
        .single()) as DbResult<{ id: string }>;
      expect(sourceInsert.error).toBeNull();
      const sourceId = sourceInsert.data!.id;
      cleanup.sourceIds.push(sourceId);
      const query = (await rawAdmin
        .from("opportunity_generated_queries")
        .insert({
          template_id: templates.data![0].id,
          query_text: `2099 China scholarship official ${suffix}`,
          query_fingerprint: suffix.padEnd(64, "a"),
          scheduled_for: "2099-01-01",
          status: "succeeded",
          finished_at: new Date().toISOString(),
        })
        .select("id")
        .single()) as DbResult<{ id: string }>;
      expect(query.error).toBeNull();
      cleanup.queryIds.push(query.data!.id);
      const search = (await rawAdmin
        .from("opportunity_search_runs")
        .insert({
          query_id: query.data!.id,
          provider: "brave",
          requested_result_count: 1,
          returned_result_count: 1,
          state: "succeeded",
          quota_day: "2099-01-01",
          quota_month: "2099-01-01",
          finished_at: new Date().toISOString(),
        })
        .select("id")
        .single()) as DbResult<{ id: string }>;
      expect(search.error).toBeNull();
      cleanup.searchIds.push(search.data!.id);
      const canonicalUrl = `https://${domain}/scholarship/${suffix}`;
      const lead = (await rawAdmin.rpc("phase15_record_discovery_lead", {
        candidate_search_run: search.data!.id,
        candidate_query: query.data!.id,
        candidate_result_url: canonicalUrl,
        candidate_canonical_url: canonicalUrl,
        candidate_domain: domain,
        candidate_title: "Phase 15 hosted scholarship",
        candidate_snippet: "Internal hint only",
        candidate_position: 1,
        candidate_language: "en",
        candidate_provider_result_id: null,
        candidate_fingerprint: crypto.randomUUID().replaceAll("-", "").padEnd(64, "a"),
      })) as DbResult<Array<{ lead_id: string; created: boolean }>>;
      expect(lead.error).toBeNull();
      const leadId = lead.data![0].lead_id;
      cleanup.leadIds.push(leadId);

      const anonymous = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      }) as unknown as RawClient;
      expect((await anonymous.from("opportunity_discovery_leads").select("id")).error).not.toBeNull();
      expect(
        (
          await anonymous.rpc("phase15_consume_search_quota", {
            candidate_provider: "brave",
            candidate_daily_limit: 25,
            candidate_monthly_limit: 750,
            requested_calls: 1,
          })
        ).error,
      ).not.toBeNull();

      const published = (await rawAdmin.rpc("phase15_publish_candidate", {
        candidate_lead: leadId,
        candidate_source: sourceId,
        candidate_type_code: "scholarship",
        candidate_title: "Phase 15 hosted scholarship",
        candidate_normalized_title: `phase 15 hosted scholarship ${suffix}`,
        candidate_organization: `Phase 15 University ${suffix}`,
        candidate_destination_code: "CN",
        candidate_is_global: false,
        candidate_summary: "A deterministic hosted security fixture.",
        candidate_canonical_url: canonicalUrl,
        candidate_application_url: canonicalUrl,
        candidate_deadline: "2099-12-31",
        candidate_rolling: false,
        candidate_funding: "full",
        candidate_sponsorship: "not_stated",
        candidate_content_hash: suffix.padEnd(64, "b"),
        candidate_duplicate_key: `phase15:${suffix}`,
        candidate_evidence_excerpt: "Official scholarship applications close on 2099-12-31.",
        candidate_decision_fingerprint: suffix.padEnd(64, "c"),
      })) as DbResult<Array<{ opportunity_id: string; created: boolean }>>;
      expect(published.error).toBeNull();
      expect(published.data?.[0]?.created).toBe(true);
      const opportunityId = published.data![0].opportunity_id;
      cleanup.opportunityIds.push(opportunityId);
      cleanup.organizationNames.push(`phase 15 university ${suffix}`);
      const visible = (await anonymous
        .from("safe_active_opportunities")
        .select("id")
        .eq("id", opportunityId)) as DbResult<Array<{ id: string }>>;
      expect(visible.error).toBeNull();
      expect(visible.data).toEqual([{ id: opportunityId }]);

      const replay = (await rawAdmin.rpc("phase15_publish_candidate", {
        candidate_lead: leadId,
        candidate_source: sourceId,
        candidate_type_code: "scholarship",
        candidate_title: "Phase 15 hosted scholarship",
        candidate_normalized_title: `phase 15 hosted scholarship ${suffix}`,
        candidate_organization: `Phase 15 University ${suffix}`,
        candidate_destination_code: "CN",
        candidate_is_global: false,
        candidate_summary: "A deterministic hosted security fixture.",
        candidate_canonical_url: canonicalUrl,
        candidate_application_url: canonicalUrl,
        candidate_deadline: "2099-12-31",
        candidate_rolling: false,
        candidate_funding: "full",
        candidate_sponsorship: "not_stated",
        candidate_content_hash: suffix.padEnd(64, "b"),
        candidate_duplicate_key: `phase15:${suffix}`,
        candidate_evidence_excerpt: "Official scholarship applications close on 2099-12-31.",
        candidate_decision_fingerprint: suffix.padEnd(64, "c"),
      })) as DbResult<Array<{ opportunity_id: string; created: boolean }>>;
      expect(replay.error).toBeNull();
      expect(replay.data?.[0]).toMatchObject({ opportunity_id: opportunityId, created: false });

      const password = `Phase15-${crypto.randomUUID()}-Safe!`;
      const created = await admin.auth.admin.createUser({
        email: `phase15-${suffix}@example.test`,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      cleanup.users.push(created.data.user!.id);
      const ordinary = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false, storageKey: `phase15-${suffix}` },
      }) as unknown as RawClient & { auth: ReturnType<typeof createClient>["auth"] };
      expect(
        (await ordinary.auth.signInWithPassword({ email: created.data.user!.email!, password })).error,
      ).toBeNull();
      expect(
        (await ordinary.from("opportunity_discovery_leads").select("bounded_snippet")).error,
      ).not.toBeNull();
      expect(
        (await ordinary.from("opportunities").update({ title: "forged" }).eq("id", opportunityId)).error,
      ).not.toBeNull();
      expect(
        (
          await ordinary.rpc("phase15_claim_discovery_lead", {
            candidate_worker: crypto.randomUUID(),
            candidate_batch_size: 1,
            lease_seconds: 60,
          })
        ).error,
      ).not.toBeNull();
    },
    90_000,
  );
});
