import "server-only";

import type { IeltsOverview, IeltsSkill } from "@/features/ielts/types";
import { ieltsFeedbackOutputSchema } from "@/features/ielts/model";
import { parseServerEnvironment } from "@/lib/env/schema";
import { ProviderDisabledError } from "@/server/providers";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createIeltsFeedbackProvider, type IeltsFeedbackProvider } from "./provider";
import { ieltsInputFingerprint } from "./model";

type QueryResult = { data: unknown; error: unknown };
type DynamicQuery = {
  select(columns?: string): DynamicQuery;
  eq(column: string, value: string): DynamicQuery;
  in(column: string, values: string[]): DynamicQuery;
  order(column: string, options?: { ascending?: boolean }): DynamicQuery;
  insert(values: Record<string, unknown>): DynamicQuery;
  update(values: Record<string, unknown>): DynamicQuery;
  limit(count: number): Promise<QueryResult>;
  maybeSingle(): Promise<QueryResult>;
  single(): Promise<QueryResult>;
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};
type DynamicClient = {
  from(table: string): DynamicQuery;
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};

const rows = (data: unknown): Record<string, unknown>[] =>
  Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    : [];
const string = (value: unknown) => (typeof value === "string" ? value : null);
const number = (value: unknown) =>
  typeof value === "number" ? value : value === null ? null : Number(value);
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export async function getIeltsOverview(client: unknown, userId: string): Promise<IeltsOverview> {
  const db = client as DynamicClient;
  const [profileResult, contentResult, attemptsResult, feedbackResult, planResult, resourcesResult] =
    await Promise.all([
      db
        .from("ielts_profiles")
        .select("test_type,target_band,test_date,recording_retention_days")
        .eq("user_id", userId)
        .maybeSingle(),
      db.from("safe_active_ielts_content").select("*").order("slug", { ascending: true }).limit(40),
      db
        .from("ielts_attempts")
        .select("id,skill,status,score_raw,score_max,estimated_band,started_at,content_item_id")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(30),
      db
        .from("ielts_feedback")
        .select("id,skill,estimated_band,summary,strengths,recommendations,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("ielts_study_plans")
        .select("weak_areas,recommendation")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
      db
        .from("safe_active_ielts_resources")
        .select("*")
        .order("display_order", { ascending: true })
        .limit(20),
    ]);
  const profileRow =
    profileResult.data && typeof profileResult.data === "object"
      ? (profileResult.data as Record<string, unknown>)
      : null;
  const content = rows(contentResult.data).flatMap((row) => {
    const id = string(row.id);
    const slug = string(row.slug);
    const title = string(row.title);
    const instructions = string(row.instructions);
    const testType = string(row.test_type);
    const skill = string(row.skill);
    const activityKind = string(row.activity_kind);
    const durationSeconds = number(row.duration_seconds);
    const contentVersion = number(row.content_version);
    if (!id || !slug || !title || !instructions || !durationSeconds || !contentVersion) return [];
    if (
      !["academic", "general", "both"].includes(testType ?? "") ||
      !["reading", "writing", "speaking"].includes(skill ?? "") ||
      !["diagnostic", "practice"].includes(activityKind ?? "")
    )
      return [];
    return [
      {
        id,
        slug,
        title,
        instructions,
        testType: testType as "academic" | "general" | "both",
        skill: skill as IeltsSkill,
        activityKind: activityKind as "diagnostic" | "practice",
        durationSeconds,
        content: object(row.content),
        rubric: object(row.rubric),
        provenanceType:
          string(row.provenance_type) === "licensed" ? ("licensed" as const) : ("original" as const),
        provenanceTitle: string(row.provenance_title) ?? "Governed practice content",
        provenanceAuthor: string(row.provenance_author) ?? "WAYFOUND editorial team",
        provenanceUrl: string(row.provenance_url),
        licenceStatus: "approved" as const,
        contentVersion,
      },
    ];
  });
  const titles = new Map(content.map((item) => [item.id, item.title]));
  const planRow = rows(planResult.data)[0];
  const recommendation = object(planRow?.recommendation);
  const env = parseServerEnvironment();
  return {
    profile: profileRow
      ? {
          testType: string(profileRow.test_type) === "general" ? "general" : "academic",
          targetBand: number(profileRow.target_band) ?? 6.5,
          testDate: string(profileRow.test_date),
          recordingRetentionDays: number(profileRow.recording_retention_days) ?? 30,
        }
      : null,
    content,
    attempts: rows(attemptsResult.data).flatMap((row) => {
      const id = string(row.id);
      const skill = string(row.skill);
      const status = string(row.status);
      const startedAt = string(row.started_at);
      if (
        !id ||
        !startedAt ||
        !["reading", "writing", "speaking"].includes(skill ?? "") ||
        !["in_progress", "interrupted", "completed", "abandoned"].includes(status ?? "")
      )
        return [];
      return [
        {
          id,
          title: titles.get(string(row.content_item_id) ?? "") ?? "IELTS practice",
          skill: skill as IeltsSkill,
          status: status as "in_progress" | "interrupted" | "completed" | "abandoned",
          scoreRaw: number(row.score_raw),
          scoreMax: number(row.score_max),
          estimatedBand: number(row.estimated_band),
          startedAt,
        },
      ];
    }),
    feedback: rows(feedbackResult.data).flatMap((row) => {
      const id = string(row.id);
      const skill = string(row.skill);
      const summary = string(row.summary);
      const createdAt = string(row.created_at);
      const estimatedBand = number(row.estimated_band);
      return id && summary && createdAt && estimatedBand && (skill === "writing" || skill === "speaking")
        ? [
            {
              id,
              skill,
              estimatedBand,
              summary,
              strengths: strings(row.strengths),
              recommendations: strings(row.recommendations),
              createdAt,
            },
          ]
        : [];
    }),
    studyPlan: planRow
      ? {
          headline: string(recommendation.headline) ?? "Continue balanced practice.",
          nextSteps: strings(recommendation.next_steps),
          minutesPerDay: number(recommendation.minutes_per_day) ?? 25,
          weakAreas: strings(planRow.weak_areas).filter((area): area is IeltsSkill =>
            ["reading", "writing", "speaking"].includes(area),
          ),
        }
      : null,
    resources: rows(resourcesResult.data).flatMap((row) => {
      const id = string(row.id);
      const title = string(row.title);
      const publisher = string(row.publisher);
      const url = string(row.resource_url);
      const testType = string(row.test_type);
      return id && title && publisher && url && ["academic", "general", "both"].includes(testType ?? "")
        ? [{ id, title, publisher, url, testType: testType as "academic" | "general" | "both" }]
        : [];
    }),
    providerConfigured: env.AI_PROVIDER === "gemini" && Boolean(env.AI_API_KEY && env.AI_MODEL),
  };
}

export async function createEstimatedFeedback(input: {
  userId: string;
  userClient: unknown;
  contentId: string;
  idempotencyKey: string;
  skill: "writing" | "speaking";
  responseText: string;
  elapsedSeconds: number;
  recordingId?: string;
  provider?: IeltsFeedbackProvider;
}) {
  const userDb = input.userClient as DynamicClient;
  const started = await userDb.rpc("phase13_start_attempt", {
    candidate_content_id: input.contentId,
    candidate_attempt_kind: "practice",
    candidate_idempotency_key: input.idempotencyKey,
  });
  if (started.error || typeof started.data !== "string") throw new Error("ATTEMPT_UNAVAILABLE");
  const attemptId = started.data;
  const admin = createSupabaseAdminClient() as unknown as DynamicClient;
  const existing = await admin.from("ielts_feedback").select("*").eq("attempt_id", attemptId).maybeSingle();
  if (existing.data && typeof existing.data === "object")
    return { attemptId, feedback: existing.data, duplicate: true };
  const contentResult = await admin
    .from("ielts_content_items")
    .select("skill,content,rubric,status,licence_status")
    .eq("id", input.contentId)
    .single();
  const content =
    contentResult.data && typeof contentResult.data === "object"
      ? (contentResult.data as Record<string, unknown>)
      : null;
  if (
    !content ||
    content.skill !== input.skill ||
    content.status !== "active" ||
    content.licence_status !== "approved"
  )
    throw new Error("CONTENT_UNAVAILABLE");
  if (input.skill === "speaking") {
    const recording = await admin
      .from("ielts_speaking_recordings")
      .select("id,user_id,attempt_id")
      .eq("id", input.recordingId ?? "")
      .single();
    const row =
      recording.data && typeof recording.data === "object"
        ? (recording.data as Record<string, unknown>)
        : null;
    if (!row || row.user_id !== input.userId || row.attempt_id !== attemptId)
      throw new Error("RECORDING_UNAVAILABLE");
  }
  const payload = object(content.content);
  const task = string(payload.prompt) ?? "Complete the governed practice task.";
  let evaluated;
  try {
    evaluated = ieltsFeedbackOutputSchema.parse(
      await (input.provider ?? createIeltsFeedbackProvider()).evaluate({
        skill: input.skill,
        task,
        responseText: input.responseText,
        rubric: object(content.rubric),
      }),
    );
  } catch (error) {
    await userDb.rpc("phase13_set_attempt_interrupted", {
      candidate_attempt_id: attemptId,
      candidate_elapsed_seconds: input.elapsedSeconds,
    });
    if (error instanceof ProviderDisabledError) throw error;
    throw new Error("FEEDBACK_REJECTED");
  }
  const fingerprint = ieltsInputFingerprint({
    contentId: input.contentId,
    skill: input.skill,
    responseText: input.responseText,
    rubric: content.rubric,
  });
  const adminClient = createSupabaseAdminClient();
  const storedResponse = await adminClient.from("ielts_attempt_responses").insert({
    attempt_id: attemptId,
    user_id: input.userId,
    question_key: input.skill === "writing" ? "writing_response" : "transcript",
    response_text: input.responseText,
    is_correct: null,
    awarded_score: 1,
    maximum_score: 1,
  });
  if (storedResponse.error) throw new Error("FEEDBACK_SAVE_FAILED");
  const feedback = await adminClient
    .from("ielts_feedback")
    .insert({
      attempt_id: attemptId,
      user_id: input.userId,
      skill: input.skill,
      estimated_band: evaluated.estimatedBand,
      dimensions: evaluated.dimensions,
      strengths: evaluated.strengths,
      recommendations: evaluated.recommendations,
      summary: evaluated.summary,
      schema_version: evaluated.schemaVersion,
      provider_name: "configured-ai",
      model_version: "phase13.feedback.v1",
      input_fingerprint: fingerprint,
    })
    .select("*")
    .single();
  if (feedback.error) throw new Error("FEEDBACK_SAVE_FAILED");
  const completion = await adminClient
    .from("ielts_attempts")
    .update({
      status: "completed",
      elapsed_seconds: input.elapsedSeconds,
      score_raw: evaluated.estimatedBand,
      score_max: 9,
      estimated_band: evaluated.estimatedBand,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("user_id", input.userId);
  if (completion.error) throw new Error("FEEDBACK_SAVE_FAILED");
  if (input.skill === "speaking" && input.recordingId)
    await adminClient
      .from("ielts_speaking_recordings")
      .update({ status: "feedback_ready" })
      .eq("id", input.recordingId)
      .eq("user_id", input.userId);
  return { attemptId, feedback: feedback.data, duplicate: false };
}
