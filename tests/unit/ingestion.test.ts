import { describe, expect, it } from "vitest";
import {
  candidateContentHash,
  eligibleSource,
  runIngestion,
  type IngestionStore,
} from "@/server/ingestion/pipeline";
import {
  assertSafeSourceUrl,
  classifyFetchFailure,
  redactOperationalError,
} from "@/server/ingestion/security";
import type { SourceAdapter, SourcePolicy } from "@/server/ingestion/types";

const sourceId = "11111111-1111-4111-8111-111111111111";
const policy: SourcePolicy = {
  sourceId,
  sourceType: "official_university",
  discoveryMethod: "official_feed",
  adapterIdentifier: "fixture.university",
  adapterVersion: "1.0.0",
  active: true,
  allowed: true,
  isFixture: false,
  robotsStatus: "allowed",
  termsStatus: "approved",
  allowedDomains: ["source.example.test"],
  requestTimeoutMs: 1000,
  responseSizeLimitBytes: 2048,
  redirectLimit: 2,
  retryLimit: 2,
  concurrencyLimit: 1,
};
const candidate = {
  externalSourceId: "scholarship-1",
  canonicalUrl: "https://source.example.test/opportunities/1",
  contentHash: candidateContentHash("stable source fact"),
  title: "Deterministic scholarship",
  normalizedTitle: "deterministic scholarship",
  organizationName: "Fixture University",
  opportunityTypeCode: "scholarship" as const,
  destinationCountryCode: "CN",
  lifecycleStatus: "active" as const,
  applicationDeadline: "2027-12-31",
  rollingDeadline: false,
  fundingCoverage: "not_stated" as const,
  sponsorshipStatus: "not_stated" as const,
  evidence: [
    {
      factPath: "opportunity.title",
      excerpt: "Deterministic scholarship opening.",
      sourceUrl: "https://source.example.test/opportunities/1",
    },
  ],
};
const adapter: SourceAdapter = {
  identifier: "fixture.university",
  version: "1.0.0",
  supportedSourceTypes: ["official_university"],
  async discover() {
    return {
      candidates: [
        { url: candidate.canonicalUrl, externalSourceId: candidate.externalSourceId },
        { url: "https://source.example.test/bad" },
      ],
      nextCursor: { page: 2 },
      complete: true,
    };
  },
  async extract({ url }) {
    if (url.endsWith("bad")) throw new Error("Malformed extraction");
    return candidate;
  },
};
class Store implements IngestionStore {
  held = false;
  stored = new Map<string, string>();
  checkpoint: Record<string, unknown> = {};
  rejected: string[] = [];
  async acquireLease() {
    if (this.held) return false;
    this.held = true;
    return true;
  }
  async releaseLease() {
    this.held = false;
  }
  async getCheckpoint() {
    return this.checkpoint;
  }
  async saveCheckpoint(_sourceId: string, cursor: Record<string, unknown>) {
    this.checkpoint = cursor;
  }
  async getBySourceRecord(_sourceId: string, _external: string | undefined, canonical: string) {
    const contentHash = this.stored.get(canonical);
    return contentHash ? { id: canonical, contentHash } : null;
  }
  async persist(value: typeof candidate & { duplicateKey: string }) {
    this.stored.set(value.canonicalUrl, value.contentHash);
    return "created" as const;
  }
  async reject(reason: string) {
    this.rejected.push(reason);
  }
}

describe("Phase 5 ingestion boundaries", () => {
  it("rejects arbitrary, private and off-policy URLs", () => {
    expect(() => assertSafeSourceUrl("http://source.example.test/a", policy)).toThrow();
    expect(() => assertSafeSourceUrl("https://127.0.0.1/a", policy)).toThrow();
    expect(() => assertSafeSourceUrl("https://evil.example/a", policy)).toThrow();
    expect(assertSafeSourceUrl(candidate.canonicalUrl, policy).hostname).toBe("source.example.test");
  });
  it("requires an approved source and matching registered adapter", () => {
    expect(eligibleSource(policy, adapter)).toEqual(policy);
    expect(() => eligibleSource({ ...policy, robotsStatus: "review_required" }, adapter)).toThrow();
    expect(() => eligibleSource({ ...policy, adapterVersion: "2.0.0" }, adapter)).toThrow();
  });
  it("is bounded, idempotent, restartable, and isolates one malformed record", async () => {
    const store = new Store();
    const first = await runIngestion({ policy, adapter, store, ownerId: crypto.randomUUID() });
    expect(first).toMatchObject({ created: 1, rejected: 1, nextCursor: { page: 2 } });
    const second = await runIngestion({ policy, adapter, store, ownerId: crypto.randomUUID() });
    expect(second).toMatchObject({ unchanged: 1, rejected: 1 });
    expect(store.held).toBe(false);
  });
  it("classifies retries and redacts unsafe operational detail", () => {
    expect(classifyFetchFailure(new Error("timeout"), 1, 2).retryable).toBe(true);
    expect(classifyFetchFailure(new Error("Unsafe source URL"), 1, 2).retryable).toBe(false);
    expect(
      redactOperationalError(new Error("Authorization: Bearer value https://private.example/a")),
    ).not.toContain("value");
  });
});
