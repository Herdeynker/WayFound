import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/supabase/database.types";

loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(url && publicKey && secretKey);
const testCase = live ? it : it.skip;
const admin = live
  ? createClient<Database>(url!, secretKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const createdUsers: string[] = [];
const objectPaths: string[] = [];
const userClient = (key: string) =>
  createClient<Database>(url!, publicKey!, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: key },
  });

async function clearPriorFixtures() {
  if (!admin) return;
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  expect(users.error).toBeNull();
  for (const user of users.data.users.filter((item) =>
    /^phase13-[ab]-.*@example\.test$/.test(item.email ?? ""),
  )) {
    const objects = await admin.storage.from("user-documents").list(user.id, { limit: 1000, offset: 0 });
    if (!objects.error) {
      const collect = async (prefix: string): Promise<string[]> => {
        const listed = await admin.storage.from("user-documents").list(prefix, { limit: 1000, offset: 0 });
        const paths: string[] = [];
        for (const entry of listed.data ?? []) {
          const path = `${prefix}/${entry.name}`;
          if (entry.id) paths.push(path);
          else paths.push(...(await collect(path)));
        }
        return paths;
      };
      const paths = await collect(user.id);
      if (paths.length) await admin.storage.from("user-documents").remove(paths);
    }
    expect((await admin.auth.admin.deleteUser(user.id)).error).toBeNull();
  }
}

describe("Phase 13 hosted IELTS ownership, scoring and storage", () => {
  beforeAll(clearPriorFixtures, 45_000);
  afterAll(async () => {
    if (!admin) return;
    if (objectPaths.length) await admin.storage.from("user-documents").remove(objectPaths);
    for (const userId of createdUsers) expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
  }, 45_000);

  testCase(
    "enforces provenance, deterministic replay, RLS, private recording isolation and account cleanup",
    async () => {
      const password = `Phase13-${crypto.randomUUID()}-Safe!`;
      const [createdA, createdB] = await Promise.all(
        ["a", "b"].map((suffix) =>
          admin!.auth.admin.createUser({
            email: `phase13-${suffix}-${crypto.randomUUID()}@example.test`,
            password,
            email_confirm: true,
          }),
        ),
      );
      expect(createdA.error).toBeNull();
      expect(createdB.error).toBeNull();
      const userA = createdA.data.user!.id;
      const userB = createdB.data.user!.id;
      createdUsers.push(userA, userB);
      const clientA = userClient(`phase13-a-${crypto.randomUUID()}`);
      const clientB = userClient(`phase13-b-${crypto.randomUUID()}`);
      const anonymous = userClient(`phase13-anon-${crypto.randomUUID()}`);
      expect(
        (await clientA.auth.signInWithPassword({ email: createdA.data.user!.email!, password })).error,
      ).toBeNull();
      expect(
        (await clientB.auth.signInWithPassword({ email: createdB.data.user!.email!, password })).error,
      ).toBeNull();

      expect((await anonymous.from("safe_active_ielts_content").select("id")).error).not.toBeNull();
      expect((await clientA.from("ielts_content_items").select("answer_key")).error).not.toBeNull();
      const safeContent = await clientA
        .from("safe_active_ielts_content")
        .select("id,slug,test_type,skill,activity_kind,content");
      expect(safeContent.error).toBeNull();
      expect(safeContent.data!.length).toBeGreaterThanOrEqual(6);
      expect(safeContent.data!.every((item) => !("answer_key" in item))).toBe(true);
      const invalidContent = await admin!.from("ielts_content_items").insert({
        slug: `phase13-unapproved-${crypto.randomUUID()}`,
        test_type: "both",
        skill: "writing",
        activity_kind: "practice",
        title: "Unapproved active test",
        instructions: "This row must never become active practice.",
        duration_seconds: 600,
        content: { prompt: "Synthetic test only." },
        provenance_type: "original",
        provenance_title: "Synthetic unapproved fixture",
        provenance_author: "WAYFOUND tests",
        licence_status: "pending",
        status: "active",
        activated_at: new Date().toISOString(),
      });
      expect(invalidContent.error).not.toBeNull();

      expect(
        (
          await clientA
            .from("ielts_profiles")
            .insert({ user_id: userA, test_type: "academic", target_band: 7, recording_retention_days: 7 })
        ).error,
      ).toBeNull();
      expect(
        (
          await clientB
            .from("ielts_profiles")
            .insert({ user_id: userB, test_type: "general", target_band: 6.5, recording_retention_days: 7 })
        ).error,
      ).toBeNull();
      expect((await clientA.from("ielts_profiles").select("user_id")).data).toEqual([{ user_id: userA }]);
      expect(
        (await clientA.from("ielts_profiles").update({ user_id: userB }).eq("user_id", userA)).error,
      ).not.toBeNull();
      expect(
        (
          await clientA.from("ielts_attempts").insert({
            user_id: userA,
            content_item_id: safeContent.data![0].id!,
            content_version: 1,
            attempt_kind: "diagnostic",
            skill: "reading",
            idempotency_key: crypto.randomUUID(),
            duration_seconds: 600,
          })
        ).error,
      ).not.toBeNull();

      const diagnostic = safeContent.data!.find((item) => item.slug === "academic-city-shade-diagnostic")!;
      const attemptKey = crypto.randomUUID();
      const attempt = await clientA.rpc("phase13_start_attempt", {
        candidate_content_id: diagnostic.id!,
        candidate_attempt_kind: "diagnostic",
        candidate_idempotency_key: attemptKey,
      });
      expect(attempt.error).toBeNull();
      const replayStart = await clientA.rpc("phase13_start_attempt", {
        candidate_content_id: diagnostic.id!,
        candidate_attempt_kind: "diagnostic",
        candidate_idempotency_key: attemptKey,
      });
      expect(replayStart.data).toBe(attempt.data);
      expect((await clientB.from("ielts_attempts").select("id").eq("id", attempt.data!)).data).toHaveLength(
        0,
      );
      expect(
        (
          await clientB.rpc("phase13_submit_reading", {
            candidate_attempt_id: attempt.data!,
            candidate_answers: { q1: "Releasing water vapour" },
            candidate_elapsed_seconds: 20,
          })
        ).error,
      ).not.toBeNull();

      const scored = await clientA.rpc("phase13_submit_reading", {
        candidate_attempt_id: attempt.data!,
        candidate_answers: {
          q1: "Releasing water vapour",
          q2: "They require years of care",
          q3: "Pale roof materials",
          q4: "wrong",
        },
        candidate_elapsed_seconds: 120,
      });
      expect(scored.error).toBeNull();
      expect(scored.data).toMatchObject({ score: 3, maximum: 4, estimatedBand: 7.5, duplicate: false });
      const replayScore = await clientA.rpc("phase13_submit_reading", {
        candidate_attempt_id: attempt.data!,
        candidate_answers: {},
        candidate_elapsed_seconds: 200,
      });
      expect(replayScore.error).toBeNull();
      expect(replayScore.data).toMatchObject({ score: 3, maximum: 4, estimatedBand: 7.5, duplicate: true });
      expect(
        (await clientA.from("ielts_attempts").update({ estimated_band: 9 }).eq("id", attempt.data!)).error,
      ).not.toBeNull();
      const response = await admin!
        .from("ielts_attempt_responses")
        .select("id")
        .eq("attempt_id", attempt.data!)
        .limit(1)
        .single();
      expect(response.error).toBeNull();
      expect(
        (
          await admin!
            .from("ielts_attempt_responses")
            .update({ response_text: "rewritten" })
            .eq("id", response.data!.id)
        ).error,
      ).not.toBeNull();
      expect((await clientA.from("ielts_study_plans").select("id,weak_areas")).data).toHaveLength(1);
      expect((await clientB.from("ielts_study_plans").select("id")).data).toHaveLength(0);

      const speaking = safeContent.data!.find((item) => item.slug === "shared-learning-speaking")!;
      const speakingKey = crypto.randomUUID();
      const speakingAttempt = await clientA.rpc("phase13_start_attempt", {
        candidate_content_id: speaking.id!,
        candidate_attempt_kind: "practice",
        candidate_idempotency_key: speakingKey,
      });
      expect(speakingAttempt.error).toBeNull();
      const document = await admin!
        .from("document_metadata")
        .upsert(
          {
            user_id: userA,
            document_type: "ielts_speaking_recording",
            category: "language",
            readiness_status: "available",
            original_filename: "synthetic.webm",
            mime_type: "audio/webm",
            size_bytes: 24,
          },
          { onConflict: "user_id,document_type" },
        )
        .select("id")
        .single();
      expect(document.error).toBeNull();
      const path = `${userA}/${document.data!.id}/${crypto.randomUUID()}.webm`;
      const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...new Array(20).fill(0)]);
      expect(
        (await admin!.storage.from("user-documents").upload(path, bytes, { contentType: "audio/webm" }))
          .error,
      ).toBeNull();
      objectPaths.push(path);
      const version = await admin!
        .from("document_versions")
        .insert({
          document_id: document.data!.id,
          user_id: userA,
          storage_path: path,
          original_filename: "synthetic.webm",
          mime_type: "audio/webm",
          size_bytes: bytes.length,
          checksum_sha256: "a".repeat(64),
          version_number: 1,
          idempotency_key: speakingKey,
        })
        .select("id")
        .single();
      expect(version.error).toBeNull();
      const recording = await admin!
        .from("ielts_speaking_recordings")
        .insert({
          attempt_id: speakingAttempt.data!,
          user_id: userA,
          document_id: document.data!.id,
          document_version_id: version.data!.id,
          transcript:
            "This synthetic transcript contains no real personal information and supports a private test.",
          retention_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        })
        .select("id")
        .single();
      expect(recording.error).toBeNull();
      expect((await clientA.from("ielts_speaking_recordings").select("id")).data).toHaveLength(1);
      expect((await clientB.from("ielts_speaking_recordings").select("id")).data).toHaveLength(0);
      expect((await clientA.storage.from("user-documents").download(path)).error).toBeNull();
      expect((await clientB.storage.from("user-documents").download(path)).error).not.toBeNull();
      expect(
        (
          await clientA.from("ielts_feedback").insert({
            attempt_id: speakingAttempt.data!,
            user_id: userA,
            skill: "speaking",
            estimated_band: 9,
            dimensions: [
              { criterion: "fluency", estimatedBand: 9, note: "forged" },
              { criterion: "coherence", estimatedBand: 9, note: "forged" },
            ],
            recommendations: ["forged"],
            summary: "This direct client write must fail.",
            schema_version: "phase13.feedback.v1",
            provider_name: "forged",
            model_version: "forged",
            input_fingerprint: "b".repeat(64),
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await clientA
            .from("ielts_speaking_recordings")
            .update({ transcript: "rewritten by client" })
            .eq("id", recording.data!.id)
        ).error,
      ).not.toBeNull();

      expect((await admin!.storage.from("user-documents").remove([path])).error).toBeNull();
      objectPaths.splice(objectPaths.indexOf(path), 1);
      expect((await admin!.auth.admin.deleteUser(userA)).error).toBeNull();
      createdUsers.splice(createdUsers.indexOf(userA), 1);
      expect((await admin!.from("ielts_attempts").select("id").eq("user_id", userA)).data).toHaveLength(0);
      expect((await admin!.from("ielts_study_plans").select("id").eq("user_id", userA)).data).toHaveLength(0);
    },
    90_000,
  );
});
