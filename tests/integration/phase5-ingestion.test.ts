import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { afterAll, describe, expect, it } from "vitest";

loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(url && publicKey && secretKey);
const testCase = live ? it : it.skip;
const admin = live
  ? createClient(url!, secretKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const runIds: string[] = [];
const userIds: string[] = [];

describe("Phase 5 ingestion operational boundaries", () => {
  afterAll(async () => {
    if (!admin) return;
    for (const id of runIds) await admin.from("ingestion_runs").delete().eq("id", id);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  testCase(
    "enforces operational constraints and keeps ingestion server-only",
    async () => {
      const source = await admin!.from("source_registry").select("id").limit(1).single();
      expect(source.error).toBeNull();
      if (!source.data) throw new Error("Expected the Phase 4 source registry fixture.");
      const run = await admin!
        .from("ingestion_runs")
        .insert({
          correlation_id: `phase5-${crypto.randomUUID()}`,
          adapter_identifier: "fixture.test",
          adapter_version: "1.0.0",
        })
        .select("id")
        .single();
      expect(run.error).toBeNull();
      if (!run.data) throw new Error("Could not create test run.");
      runIds.push(run.data.id);
      const sourceRun = await admin!
        .from("ingestion_source_runs")
        .insert({
          ingestion_run_id: run.data.id,
          source_id: source.data.id,
          adapter_identifier: "fixture.test",
          adapter_version: "1.0.0",
          state: "succeeded",
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      expect(sourceRun.error).toBeNull();
      const malformedFailure = await admin!.from("ingestion_failures").insert({
        source_run_id: sourceRun.data!.id,
        failure_stage: "fetch",
        classification: "timeout",
        retryable: false,
        attempt_number: 1,
        safe_error_summary: "x",
        next_retry_at: new Date().toISOString(),
      });
      expect(malformedFailure.error).not.toBeNull();
      const anonymous = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      expect((await anonymous.from("ingestion_runs").select("id")).error).not.toBeNull();
      const email = `phase5-${crypto.randomUUID()}@example.test`;
      const password = `Phase5-${crypto.randomUUID()}-Safe!`;
      const user = await admin!.auth.admin.createUser({ email, password, email_confirm: true });
      expect(user.error).toBeNull();
      userIds.push(user.data.user!.id);
      const ordinary = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false, storageKey: `phase5-${crypto.randomUUID()}` },
      });
      expect((await ordinary.auth.signInWithPassword({ email, password })).error).toBeNull();
      expect((await ordinary.from("ingestion_runs").select("safe_error_summary")).error).not.toBeNull();
      expect(
        (
          await ordinary
            .from("ingestion_checkpoints")
            .upsert({ source_id: source.data.id, adapter_identifier: "nope", adapter_version: "1" })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await ordinary.rpc("phase5_acquire_source_lease", {
            source: source.data.id,
            owner: crypto.randomUUID(),
            correlation: "phase5-client-denied",
            duration_seconds: 60,
          })
        ).error,
      ).not.toBeNull();
    },
    45_000,
  );
});
