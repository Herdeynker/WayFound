import { describe, expect, it, vi } from "vitest";
import {
  extractListingUrls,
  extractOpportunityFromHtml,
  extractOpportunityFromJson,
} from "@/server/discovery/extraction";
import {
  buildDailyQueryPlan,
  buildQueryCatalog,
  canonicalizeDiscoveryUrl,
  checkPublicationSafety,
  classifyDuplicate,
  nextRecheckAt,
  parseDiscoveryConfiguration,
  resolveRegisteredSource,
} from "@/server/discovery/model";
import { BraveSearchProvider } from "@/server/discovery/provider";
import { DomainCircuitBreaker, ZeroCostQuotaLedger } from "@/server/discovery/quota";
import {
  DiscoveryUnavailableError,
  runWebDiscovery,
  scheduleKnownSourceMonitoring,
} from "@/server/discovery/service";
import type {
  AutonomousDiscoveryStore,
  PublishedOpportunity,
  RegisteredSource,
  SearchResult,
} from "@/server/discovery/types";
import { fetchRegisteredSource } from "@/server/ingestion/security";
import type { SourcePolicy } from "@/server/ingestion/types";

const officialSource: RegisteredSource = {
  id: "11111111-1111-4111-8111-111111111111",
  baseUrl: "https://careers.example.test/",
  canonicalDomain: "careers.example.test",
  allowedDomains: ["careers.example.test"],
  sourceType: "official_employer",
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
  refreshFrequencyHours: 6,
};

class SearchStore implements AutonomousDiscoveryStore {
  query = {
    id: crypto.randomUUID(),
    text: "2027 Canada scholarship international applicants official deadline",
    fingerprint: "a".repeat(64),
  };
  quotaAllowed = true;
  results: SearchResult[] = [];
  failure?: string;
  directLeads = 0;
  async saveQueries() {
    return 0;
  }
  async consumeQuota() {
    return {
      allowed: this.quotaAllowed,
      dailyUsed: 1,
      monthlyUsed: 1,
      dailyRemaining: this.quotaAllowed ? 24 : 0,
      monthlyRemaining: 749,
    };
  }
  async nextQueuedQuery() {
    const query = this.query;
    this.query = null as unknown as typeof this.query;
    return query;
  }
  async beginSearch() {
    return crypto.randomUUID();
  }
  async saveSearchResults(input: { results: SearchResult[] }) {
    this.results = input.results;
    return { created: input.results.length, duplicates: 0 };
  }
  async failSearch(_queryId: string, _runId: string | null, code: string) {
    this.failure = code;
  }
  async finishSearch() {}
  async listRegisteredSources() {
    return [officialSource];
  }
  async claimLeads() {
    return [];
  }
  async recordResolution() {}
  async recordRetrieval() {
    return crypto.randomUUID();
  }
  async recordExtraction() {}
  async updateSourceMonitorState() {}
  async completeLead() {}
  async publishCandidate(): Promise<PublishedOpportunity> {
    throw new Error("not used");
  }
  async dispatchMatchingAndNotifications() {
    return { matches: 0, notifications: 0 };
  }
  async saveDirectSourceLead() {
    this.directLeads += 1;
    return true;
  }
}

describe("Phase 15 query generation", () => {
  it("covers all nine destinations and seven opportunity types without private user data", () => {
    const catalog = buildQueryCatalog(2027);
    expect(catalog).toHaveLength(63);
    expect(new Set(catalog.map((item) => item.destinationCountryCode)).size).toBe(9);
    expect(new Set(catalog.map((item) => item.opportunityTypeCode)).size).toBe(7);
    expect(catalog.every((item) => item.originCountryCode === "NG" && item.text.includes("2027"))).toBe(true);
    expect(catalog.join(" ")).not.toMatch(/email|passport id|phone|address/i);
  });

  it("rotates a bounded, deduplicated daily plan and honors lower limits", () => {
    const first = buildDailyQueryPlan({ now: new Date("2027-01-10T00:00:00Z") });
    const second = buildDailyQueryPlan({ now: new Date("2027-01-11T00:00:00Z") });
    expect(first).toHaveLength(25);
    expect(new Set(first.map((item) => item.fingerprint)).size).toBe(25);
    expect(second.map((item) => item.templateKey)).not.toEqual(first.map((item) => item.templateKey));
    expect(buildDailyQueryPlan({ limit: 7 })).toHaveLength(7);
  });

  it("uses aggregate utility signals without embedding demand data in queries", () => {
    const baseline = buildDailyQueryPlan({ now: new Date("2027-04-01T00:00:00Z") });
    const boosted = buildDailyQueryPlan({
      now: new Date("2027-04-01T00:00:00Z"),
      signals: {
        "ng.nz.skilled_trade_work": { demand: 20, usefulRate: 1, duplicateRate: 0, rejectionRate: 0 },
      },
    });
    expect(boosted.some((item) => item.templateKey === "ng.nz.skilled_trade_work")).toBe(true);
    expect(boosted.find((item) => item.templateKey === "ng.nz.skilled_trade_work")?.text).toBe(
      buildQueryCatalog(2027).find((item) => item.templateKey === "ng.nz.skilled_trade_work")?.text,
    );
    expect(baseline).toHaveLength(boosted.length);
  });
});

describe("Phase 15 zero-cost boundaries", () => {
  it("defaults disabled and rejects paid overage or limits above the hard ceiling", () => {
    expect(parseDiscoveryConfiguration({}).status).toBe("disabled");
    expect(() => parseDiscoveryConfiguration({ OPPORTUNITY_PAID_OVERAGE_ALLOWED: "true" })).toThrow();
    expect(() => parseDiscoveryConfiguration({ OPPORTUNITY_SEARCH_DAILY_LIMIT: "26" })).toThrow();
    expect(() => parseDiscoveryConfiguration({ OPPORTUNITY_SEARCH_MONTHLY_LIMIT: "751" })).toThrow();
    expect(() => parseDiscoveryConfiguration({ OPPORTUNITY_SEARCH_RESULTS_PER_QUERY: "21" })).toThrow();
  });

  it("enforces concurrent limits and resets only at UTC boundaries", async () => {
    const ledger = new ZeroCostQuotaLedger();
    const now = new Date("2027-02-01T23:59:59Z");
    const concurrent = await Promise.all(
      Array.from({ length: 40 }, () => ledger.consume({ now, dailyLimit: 25, monthlyLimit: 30 })),
    );
    expect(concurrent.filter((result) => result.allowed)).toHaveLength(25);
    expect(concurrent.at(-1)?.dailyUsed).toBe(25);
    const nextDay = await ledger.consume({
      now: new Date("2027-02-02T00:00:00Z"),
      dailyLimit: 25,
      monthlyLimit: 30,
    });
    expect(nextDay.allowed).toBe(true);
    expect(nextDay.dailyUsed).toBe(1);
    expect(nextDay.monthlyUsed).toBe(26);
    for (let index = 0; index < 4; index += 1)
      await ledger.consume({ now: new Date("2027-02-02T00:00:01Z"), dailyLimit: 25, monthlyLimit: 30 });
    expect(
      (await ledger.consume({ now: new Date("2027-02-02T00:00:02Z"), dailyLimit: 25, monthlyLimit: 30 }))
        .allowed,
    ).toBe(false);
    expect(
      (await ledger.consume({ now: new Date("2027-03-01T00:00:00Z"), dailyLimit: 25, monthlyLimit: 30 }))
        .monthlyUsed,
    ).toBe(1);
  });

  it("opens a bounded circuit after repeated failures and recovers after success", () => {
    const breaker = new DomainCircuitBreaker();
    const now = new Date("2027-01-01T00:00:00Z");
    breaker.recordFailure(now);
    breaker.recordFailure(now);
    expect(breaker.canRequest(now)).toBe(true);
    breaker.recordFailure(now);
    expect(breaker.canRequest(now)).toBe(false);
    expect(breaker.canRequest(new Date("2027-01-01T00:01:01Z"))).toBe(true);
    breaker.recordSuccess();
    expect(breaker.canRequest(now)).toBe(true);
  });
});

describe("Phase 15 source safety and extraction", () => {
  it("uses conditional source headers and accepts a bounded not-modified response", async () => {
    const request = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        "If-None-Match": '"source-v2"',
        "If-Modified-Since": "Tue, 08 Sep 2026 12:00:00 GMT",
      });
      return new Response(null, { status: 304, headers: { etag: '"source-v2"' } });
    });
    const retrieved = await fetchRegisteredSource({
      policy: {
        sourceId: officialSource.id,
        sourceType: officialSource.sourceType,
        discoveryMethod: "official_feed",
        adapterIdentifier: "phase15.test",
        adapterVersion: "phase15.v1",
        active: true,
        allowed: true,
        isFixture: false,
        robotsStatus: "allowed",
        termsStatus: "approved",
        allowedDomains: officialSource.allowedDomains,
        requestTimeoutMs: officialSource.requestTimeoutMs,
        responseSizeLimitBytes: officialSource.responseSizeLimitBytes,
        redirectLimit: officialSource.redirectLimit,
        retryLimit: officialSource.retryLimit,
        concurrencyLimit: officialSource.concurrencyLimit,
      } satisfies SourcePolicy,
      url: officialSource.baseUrl,
      request: request as typeof fetch,
      conditional: {
        etag: '"source-v2"',
        lastModified: "Tue, 08 Sep 2026 12:00:00 GMT",
      },
    });
    expect(retrieved.metadata).toMatchObject({ statusCode: 304, byteLength: 0 });
    expect(retrieved.body).toHaveLength(0);
  });

  it("canonicalizes public URLs and strips tracking without accepting private or credentialed URLs", () => {
    expect(canonicalizeDiscoveryUrl("https://www.Example.com/jobs/?utm_source=x&b=2&a=1#top")).toBe(
      "https://example.com/jobs?a=1&b=2",
    );
    expect(() => canonicalizeDiscoveryUrl("http://example.com/jobs")).toThrow();
    expect(() => canonicalizeDiscoveryUrl("https://127.0.0.1/jobs")).toThrow();
    expect(() => canonicalizeDiscoveryUrl("https://user:pass@example.com/jobs")).toThrow();
  });

  it("never upgrades a new or secondary domain to primary evidence", () => {
    expect(resolveRegisteredSource("https://careers.example.test/jobs/1", [officialSource]).status).toBe(
      "official",
    );
    expect(resolveRegisteredSource("https://news.example.test/story", [officialSource])).toMatchObject({
      status: "unverified",
    });
    expect(
      resolveRegisteredSource("https://careers.example.test/jobs/1", [
        { ...officialSource, official: false, sourceType: "approved_job_board" },
      ]).status,
    ).toBe("secondary");
    expect(
      resolveRegisteredSource("https://careers.example.test/jobs/1", [
        { ...officialSource, robotsStatus: "disallowed" },
      ]).status,
    ).toBe("blocked");
  });

  it("extracts explicit JSON-LD facts and preserves missing facts as unknown", () => {
    const html = `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Sponsored Electrical Technician",
      description: "A Canada skilled trade role. Visa sponsorship is available.",
      validThrough: "2027-12-31T23:59:59Z",
      url: "https://careers.example.test/jobs/42",
      hiringOrganization: { name: "Example Engineering" },
      jobLocation: { address: { addressCountry: "Canada" } },
    })}</script></head><body><h1>Sponsored Electrical Technician</h1></body></html>`;
    const extracted = extractOpportunityFromHtml({
      html,
      sourceUrl: "https://careers.example.test/jobs/42",
      source: officialSource,
      now: new Date("2027-01-01T00:00:00Z"),
    });
    expect(extracted.method).toBe("json_ld");
    expect(extracted.candidate).toMatchObject({
      opportunityTypeCode: "skilled_trade_work",
      destinationCountryCode: "CA",
      applicationDeadline: "2027-12-31",
      sponsorshipStatus: "vacancy_evidence",
    });

    const incomplete = extractOpportunityFromHtml({
      html: "<html><h1>Interesting opening</h1></html>",
      sourceUrl: "https://careers.example.test/jobs/empty",
      source: officialSource,
    });
    expect(incomplete.candidate).toBeUndefined();
    expect(incomplete.missing).toEqual(
      expect.arrayContaining(["organization", "opportunity_type", "deadline_treatment"]),
    );
  });

  it.each([
    ["China scholarship", "A fully funded scholarship in China.", "scholarship", "CN"],
    ["UK graduate programme", "A graduate programme in the United Kingdom.", "graduate_programme", "GB"],
    ["Canada electrician role", "An electrician skilled trade role in Canada.", "skilled_trade_work", "CA"],
    ["Australia fellowship", "A funded fellowship in Australia.", "fellowship", "AU"],
    ["Germany engineering job", "A professional job in Germany.", "professional_job", "DE"],
    ["Ireland research position", "A funded research position in Ireland.", "research_position", "IE"],
    ["Netherlands PhD", "A funded PhD position in the Netherlands.", "research_position", "NL"],
    ["United States internship", "An internship in the United States.", "internship", "US"],
    [
      "New Zealand technician role",
      "A technician skilled trade role in New Zealand.",
      "skilled_trade_work",
      "NZ",
    ],
  ])("extracts the %s fixture conservatively", (title, description, type, country) => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title,
      description,
      validThrough: "2027-12-31",
      url: `https://careers.example.test/${country.toLowerCase()}`,
      hiringOrganization: { name: "Verified Example Organisation" },
    })}</script>`;
    const extracted = extractOpportunityFromHtml({
      html,
      sourceUrl: `https://careers.example.test/${country.toLowerCase()}`,
      source: officialSource,
      now: new Date("2027-01-01T00:00:00Z"),
    });
    expect(extracted.candidate).toMatchObject({
      opportunityTypeCode: type,
      destinationCountryCode: country,
    });
  });

  it("discovers bounded feed and sitemap links without treating listing text as evidence", () => {
    const rss = extractListingUrls({
      body: "<rss><channel><item><link>https://careers.example.test/jobs/1</link></item></channel></rss>",
      contentType: "application/rss+xml",
      baseUrl: officialSource.baseUrl,
    });
    const sitemap = extractListingUrls({
      body: "<urlset><url><loc>https://careers.example.test/jobs/2</loc></url></urlset>",
      contentType: "application/xml",
      baseUrl: officialSource.baseUrl,
    });
    expect(rss).toEqual({ method: "rss", urls: ["https://careers.example.test/jobs/1"] });
    expect(sitemap.urls).toEqual(["https://careers.example.test/jobs/2"]);
  });

  it("extracts conservative structured API records without inventing missing fields", () => {
    const extracted = extractOpportunityFromJson({
      body: JSON.stringify({
        title: "Graduate engineering fellowship",
        organization: "Example Engineering",
        url: "https://careers.example.test/fellowships/12",
        application_url: "https://careers.example.test/fellowships/12/apply",
        deadline: "2027-09-30",
        country: "Canada",
        description: "A funded fellowship for international graduates.",
      }),
      sourceUrl: "https://careers.example.test/api/fellowships/12",
      source: officialSource,
      now: new Date("2027-01-01T00:00:00Z"),
    });
    expect(extracted.method).toBe("structured_api");
    expect(extracted.candidate).toMatchObject({
      title: "Graduate engineering fellowship",
      organizationName: "Example Engineering",
      applicationDeadline: "2027-09-30",
      destinationCountryCode: "CA",
    });

    const incomplete = extractOpportunityFromJson({
      body: JSON.stringify({ title: "Unknown opening" }),
      sourceUrl: "https://careers.example.test/api/openings/unknown",
      source: officialSource,
    });
    expect(incomplete.candidate).toBeUndefined();
    expect(incomplete.missing).toEqual(expect.arrayContaining(["organization", "deadline_treatment"]));
  });

  it("distinguishes exact duplicates, probable duplicates and annual cycles", () => {
    const candidate = {
      canonicalUrl: "https://careers.example.test/a",
      applicationUrl: "https://careers.example.test/a",
      contentHash: "a".repeat(64),
      normalizedTitle: "global scholarship",
      organizationName: "Example University",
      destinationCountryCode: "GB",
      opportunityTypeCode: "scholarship" as const,
      deadline: "2027-10-01",
    };
    const base = {
      id: "one",
      canonicalUrl: candidate.canonicalUrl,
      applicationUrl: null,
      externalSourceId: null,
      contentHash: "b".repeat(64),
      duplicateKey: null,
      normalizedTitle: candidate.normalizedTitle,
      normalizedOrganization: candidate.organizationName,
      destinationCountryCode: "GB",
      opportunityTypeCode: "scholarship",
      deadline: "2027-10-01",
    };
    expect(classifyDuplicate(candidate, [base]).decision).toBe("exact_duplicate");
    expect(
      classifyDuplicate(
        { ...candidate, canonicalUrl: "https://careers.example.test/b", applicationUrl: undefined },
        [{ ...base, canonicalUrl: "https://careers.example.test/c" }],
      ).decision,
    ).toBe("probable_duplicate");
    expect(
      classifyDuplicate(
        {
          ...candidate,
          canonicalUrl: "https://careers.example.test/2028",
          applicationUrl: undefined,
          deadline: "2028-10-01",
        },
        [{ ...base, canonicalUrl: "https://careers.example.test/2027" }],
      ).decision,
    ).toBe("annual_cycle");
  });

  it("requires official evidence, safe links, deadline treatment and confidence before publication", () => {
    const resolution = resolveRegisteredSource("https://careers.example.test/jobs/1", [officialSource]);
    expect(
      checkPublicationSafety({
        type: "professional_job",
        title: "Engineer",
        organization: "Example",
        destination: "CA",
        sourceResolution: resolution,
        applicationUrl: "https://careers.example.test/jobs/1",
        deadline: "2027-12-31",
        evidenceCount: 1,
        lifecycle: "active",
        confidenceDecision: "limited",
      }),
    ).toEqual({ allowed: true, reasons: [] });
    expect(
      checkPublicationSafety({
        type: "professional_job",
        title: "Engineer",
        organization: "Example",
        destination: "CA",
        sourceResolution: { status: "unverified", reason: "new" },
        applicationUrl: "https://evil.example/jobs/1",
        evidenceCount: 0,
        lifecycle: "active",
        confidenceDecision: "more_evidence",
      }).reasons,
    ).toEqual(
      expect.arrayContaining([
        "missing_primary_evidence",
        "unsafe_application_url",
        "missing_deadline_treatment",
        "missing_evidence",
        "confidence_not_publishable",
      ]),
    );
  });

  it("schedules jobs frequently, scholarships daily, registries weekly and backs off", () => {
    const now = new Date("2027-01-01T00:00:00Z");
    expect(nextRecheckAt({ now, sourceKind: "job" }).toISOString()).toBe("2027-01-01T06:00:00.000Z");
    expect(nextRecheckAt({ now, sourceKind: "scholarship" }).toISOString()).toBe("2027-01-02T00:00:00.000Z");
    expect(nextRecheckAt({ now, sourceKind: "registry" }).toISOString()).toBe("2027-01-08T00:00:00.000Z");
    expect(nextRecheckAt({ now, sourceKind: "job", failedAttempts: 2 }).toISOString()).toBe(
      "2027-01-02T00:00:00.000Z",
    );
  });
});

describe("Phase 15 Brave boundary", () => {
  it("schedules eligible known sources without consuming a Brave search", async () => {
    const store = new SearchStore();
    const result = await scheduleKnownSourceMonitoring({
      store,
      now: new Date("2027-01-01T00:00:00Z"),
      config: parseDiscoveryConfiguration({ OPPORTUNITY_DISCOVERY_ENABLED: "true" }),
    });
    expect(result).toEqual({ status: "scheduled", sources: 1, leads: 1, braveSearches: 0 });
    expect(store.directLeads).toBe(1);
  });

  it("uses a server-only header, caps results and validates provider output", async () => {
    const request = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(String(url)).not.toContain("server-secret");
      expect((init?.headers as Record<string, string>)["X-Subscription-Token"]).toBe("server-secret");
      return new Response(
        JSON.stringify({
          web: {
            results: [
              {
                title: "Official scholarship",
                url: "https://official.example/scholarship",
                description: "Open now",
              },
              { title: "Private", url: "https://127.0.0.1/nope" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json", "x-request-id": "request-1" } },
      );
    });
    const provider = new BraveSearchProvider("server-secret", request as typeof fetch);
    const result = await provider.search("2027 official scholarship international applicants", 20);
    expect(result.results).toHaveLength(1);
    expect(result.providerRequestId).toBe("request-1");
  });

  it("does not aggressively retry rate limits and reports disabled configuration honestly", async () => {
    const provider = new BraveSearchProvider(
      "server-secret",
      vi.fn(async () => new Response("{}", { status: 429 })) as typeof fetch,
    );
    await expect(
      provider.search("2027 official scholarship international applicants", 20),
    ).rejects.toMatchObject({ code: "rate_limited", retryable: false });
    const store = new SearchStore();
    await expect(
      runWebDiscovery({
        store,
        config: parseDiscoveryConfiguration({ OPPORTUNITY_DISCOVERY_ENABLED: "true" }),
      }),
    ).rejects.toBeInstanceOf(DiscoveryUnavailableError);
  });

  it("fails closed before provider access when atomic quota is exhausted", async () => {
    const store = new SearchStore();
    store.quotaAllowed = false;
    const provider = { name: "brave" as const, search: vi.fn(async () => ({ results: [] })) };
    await expect(
      runWebDiscovery({
        store,
        provider,
        config: parseDiscoveryConfiguration({
          OPPORTUNITY_DISCOVERY_ENABLED: "true",
          BRAVE_SEARCH_API_KEY: "configured",
        }),
      }),
    ).rejects.toMatchObject({ state: "quota_exhausted" });
    expect(provider.search).not.toHaveBeenCalled();
    expect(store.failure).toBe("quota_exhausted");
  });

  it("stores provider snippets only as internal leads", async () => {
    const store = new SearchStore();
    const provider = {
      name: "brave" as const,
      search: vi.fn(async () => ({
        results: [
          {
            url: "https://careers.example.test/jobs/1",
            title: "Engineer",
            snippet: "Discovery hint only",
            position: 1,
          },
        ],
      })),
    };
    const result = await runWebDiscovery({
      store,
      provider,
      config: parseDiscoveryConfiguration({
        OPPORTUNITY_DISCOVERY_ENABLED: "true",
        BRAVE_SEARCH_API_KEY: "configured",
      }),
    });
    expect(result).toMatchObject({ status: "completed", searches: 1, leads: 1 });
    expect(store.results[0].snippet).toBe("Discovery hint only");
  });
});
