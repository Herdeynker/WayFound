import "server-only";

import { prepareDuplicateKey } from "@/server/opportunities/model";
import {
  extractedCandidateSchema,
  sourcePolicySchema,
  type ExtractedCandidate,
  type SourceAdapter,
  type SourcePolicy,
} from "./types";
import { assertSafeSourceUrl, sha256 } from "./security";

export type IngestionResult = {
  created: number;
  updated: number;
  unchanged: number;
  conflicted: number;
  rejected: number;
  nextCursor: Record<string, unknown>;
};
export type IngestionStore = {
  acquireLease(sourceId: string, ownerId: string): Promise<boolean>;
  releaseLease(sourceId: string, ownerId: string): Promise<void>;
  getCheckpoint(sourceId: string): Promise<Record<string, unknown>>;
  saveCheckpoint(sourceId: string, cursor: Record<string, unknown>): Promise<void>;
  getBySourceRecord(
    sourceId: string,
    externalSourceId: string | undefined,
    canonicalUrl: string,
  ): Promise<{ contentHash: string; id: string } | null>;
  persist(
    candidate: ExtractedCandidate & { duplicateKey: string },
  ): Promise<"created" | "updated" | "unchanged" | "conflicted">;
  reject(reason: string): Promise<void>;
};

export function eligibleSource(policy: unknown, adapter: SourceAdapter): SourcePolicy {
  const parsed = sourcePolicySchema.parse(policy);
  if (adapter.identifier !== parsed.adapterIdentifier || adapter.version !== parsed.adapterVersion)
    throw new Error("Registered adapter identity mismatch.");
  if (!adapter.supportedSourceTypes.includes(parsed.sourceType))
    throw new Error("Adapter cannot process this source type.");
  return parsed;
}

export async function runIngestion(input: {
  policy: unknown;
  adapter: SourceAdapter;
  store: IngestionStore;
  ownerId: string;
}): Promise<IngestionResult> {
  const policy = eligibleSource(input.policy, input.adapter);
  if (!(await input.store.acquireLease(policy.sourceId, input.ownerId)))
    throw new Error("Source lease is already held.");
  try {
    const cursor = await input.store.getCheckpoint(policy.sourceId);
    const listing = await input.adapter.discover({ policy, cursor });
    if (listing.candidates.length > 100)
      throw new Error("Adapter exceeded the maximum page candidate count.");
    const result: IngestionResult = {
      created: 0,
      updated: 0,
      unchanged: 0,
      conflicted: 0,
      rejected: 0,
      nextCursor: listing.nextCursor,
    };
    for (const item of listing.candidates) {
      try {
        assertSafeSourceUrl(item.url, policy);
        const candidate = extractedCandidateSchema.parse(await input.adapter.extract({ policy, ...item }));
        const duplicateKey = prepareDuplicateKey({
          canonicalUrl: candidate.canonicalUrl,
          normalizedOrganization: candidate.organizationName,
          normalizedTitle: candidate.normalizedTitle,
          destinationCountryCode: candidate.destinationCountryCode,
          opportunityTypeCode: candidate.opportunityTypeCode,
          externalSourceId: candidate.externalSourceId,
        });
        const previous = await input.store.getBySourceRecord(
          policy.sourceId,
          candidate.externalSourceId,
          candidate.canonicalUrl,
        );
        const outcome =
          previous?.contentHash === candidate.contentHash
            ? "unchanged"
            : await input.store.persist({ ...candidate, duplicateKey });
        result[outcome] += 1;
      } catch (error) {
        result.rejected += 1;
        await input.store.reject(error instanceof Error ? error.message.slice(0, 500) : "Candidate rejected");
      }
    }
    await input.store.saveCheckpoint(policy.sourceId, listing.nextCursor);
    return result;
  } finally {
    await input.store.releaseLease(policy.sourceId, input.ownerId);
  }
}

export function candidateContentHash(content: string): string {
  return sha256(content);
}
