import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PassportState } from "@/features/passport/model";
import {
  emptyPassportState,
  mapLegacySectionToStage,
  materialPassportSnapshot,
  onboardingFlowVersion,
  onboardingStageIds,
  passportStateSchema,
  type OnboardingStageId,
} from "@/features/passport/model";
import { calculateActivation, calculateCompletion, findContradictions } from "./completion";
import type { Database, Json } from "@/server/supabase/database.types";

type Client = SupabaseClient<Database, "public">;
type ConfirmationResult = { profile_version_id: string; version_number: number; reused: boolean };

export async function getPassportDraft(client: Client, userId: string) {
  const { data, error } = await client
    .from("onboarding_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("We could not load your Passport draft.");
  const parsed = data ? passportStateSchema.safeParse(data.draft) : null;
  const state = parsed?.success ? parsed.data : emptyPassportState;
  return {
    state,
    progress: data ? { ...data, current_section: mapLegacySectionToStage(data.current_section) } : null,
    activation: calculateActivation(state),
    completion: calculateCompletion(state),
    contradictions: findContradictions(state),
  };
}

export async function hasCompletedPassport(client: Client, userId: string): Promise<boolean> {
  const [progress, version] = await Promise.all([
    client.from("onboarding_progress").select("completion").eq("user_id", userId).maybeSingle(),
    client
      .from("profile_versions")
      .select("id")
      .eq("user_id", userId)
      .order("version_number", { ascending: false })
      .limit(1),
  ]);
  return (
    !progress.error && !version.error && progress.data?.completion === 100 && Boolean(version.data?.length)
  );
}

function stageProgress(stage: OnboardingStageId): number {
  return Math.max(0, onboardingStageIds.indexOf(stage)) * 25;
}

export async function savePassportDraft(
  client: Client,
  userId: string,
  state: PassportState,
  currentSection: string,
) {
  const stage = mapLegacySectionToStage(currentSection);
  const passportReadiness = calculateCompletion(state);
  const activation = calculateActivation(state);
  const { data: previous } = await client
    .from("onboarding_progress")
    .select("revision,onboarding_started_at")
    .eq("user_id", userId)
    .maybeSingle();
  const { error } = await client.from("onboarding_progress").upsert(
    {
      user_id: userId,
      selected_goal_types: state.selectedGoals,
      current_section: stage,
      draft: state as unknown as Json,
      completion: stageProgress(stage),
      passport_readiness: passportReadiness.overall,
      revision: (previous?.revision ?? 0) + 1,
      flow_version: onboardingFlowVersion,
      onboarding_started_at: previous?.onboarding_started_at ?? new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("We could not save your Passport draft.");
  return { activation, completion: passportReadiness, contradictions: findContradictions(state) };
}

export async function confirmPassport(
  client: Client,
  _userId: string,
  state: PassportState,
  trigger: "initial_review" | "manual_review" = "initial_review",
) {
  const parsed = passportStateSchema.safeParse(state);
  if (!parsed.success) throw new Error("Please review the highlighted Passport fields.");
  const normalized = materialPassportSnapshot(parsed.data);
  const contradictions = findContradictions(normalized);
  const activation = calculateActivation(normalized);
  const completion = calculateCompletion(normalized);
  if (contradictions.length)
    throw new Error("Please resolve the contradictory dates or scores before confirming.");
  if (!activation.complete)
    throw new Error(
      `Complete the minimum activation fields before confirming (${activation.overall}% ready).`,
    );

  const rpc = client.rpc.bind(client) as unknown as (
    name: "phase16_confirm_onboarding",
    args: { candidate_snapshot: Json; candidate_passport_readiness: number; candidate_trigger: string },
  ) => Promise<{ data: ConfirmationResult | null; error: { message?: string } | null }>;
  const result = await rpc("phase16_confirm_onboarding", {
    candidate_snapshot: normalized as unknown as Json,
    candidate_passport_readiness: completion.overall,
    candidate_trigger: trigger,
  });
  if (result.error || !result.data) throw new Error("We could not confirm your Passport transactionally.");
  return { activation, completion, version: result.data };
}
