import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/server/supabase/database.types";
import type { EligibilityOutcome, PublicationDecision } from "./model";

type Client = SupabaseClient<Database, "public">;
type IdResult = Promise<{ data: { id: string } | null; error: unknown | null }>;
type MatchSelect = { eq(column: string, value: string): MatchSelect; maybeSingle(): IdResult };
type MatchTable = {
  insert(value: unknown): { select(columns: string): { maybeSingle(): IdResult } };
  select(columns: string): MatchSelect;
};
type MatchClient = { from(table: "match_evaluations"): MatchTable };
export type MatchWrite = {
  userId: string;
  profileVersionId: string;
  opportunityId: string;
  opportunityVersionId: string;
  confidenceAssessmentId?: string | null;
  algorithmVersion: string;
  scoringConfigurationVersion: string;
  inputFingerprint: string;
  candidateRank: number;
  eligibilityOutcome: EligibilityOutcome;
  publicationDecision: PublicationDecision;
  matchScore: number;
  readinessState:
    "ready" | "missing" | "in_progress" | "expired" | "unknown" | "conditional" | "not_applicable";
  selectionFactors: Record<string, unknown>;
};

/** Server-only append operation. A repeated material input returns its existing immutable result. */
export async function persistMatchEvaluation(client: Client, input: MatchWrite) {
  // The generated database type is refreshed after this migration is applied.
  // Keep this boundary narrow so raw rows do not leak into domain code.
  const matches = (client as unknown as MatchClient).from("match_evaluations");
  const row = {
    user_id: input.userId,
    profile_version_id: input.profileVersionId,
    opportunity_id: input.opportunityId,
    opportunity_version_id: input.opportunityVersionId,
    confidence_assessment_id: input.confidenceAssessmentId ?? null,
    algorithm_version: input.algorithmVersion,
    scoring_configuration_version: input.scoringConfigurationVersion,
    input_fingerprint: input.inputFingerprint,
    candidate_rank: input.candidateRank,
    eligibility_outcome: input.eligibilityOutcome,
    publication_decision: input.publicationDecision,
    match_score: input.matchScore,
    readiness_state: input.readinessState,
    selection_factors: input.selectionFactors as Json,
  };
  const created = await matches.insert(row).select("id").maybeSingle();
  if (!created.error) return { id: created.data!.id, created: true };
  const existing = await matches
    .select("id")
    .eq("user_id", input.userId)
    .eq("algorithm_version", input.algorithmVersion)
    .eq("scoring_configuration_version", input.scoringConfigurationVersion)
    .eq("input_fingerprint", input.inputFingerprint)
    .maybeSingle();
  if (existing.data) return { id: existing.data.id, created: false };
  throw new Error("We could not persist this deterministic match evaluation.");
}
