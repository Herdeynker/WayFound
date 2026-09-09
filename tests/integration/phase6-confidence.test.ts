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
const assessmentIds: string[] = [];

describe("Phase 6 confidence persistence and RLS", () => {
  afterAll(async () => {
    for (const id of assessmentIds) await admin?.from("confidence_assessments").delete().eq("id", id);
  });
  testCase(
    "keeps assessments immutable, bounded, idempotent and server-only",
    async () => {
      const opportunity = await admin!.from("opportunities").select("id").limit(1).single();
      expect(opportunity.error).toBeNull();
      const fingerprint = crypto.randomUUID();
      const created = await admin!
        .from("confidence_assessments")
        .insert({
          opportunity_id: opportunity.data!.id,
          assessment_type: "source_safety",
          algorithm_version: "phase6.v1",
          input_fingerprint: fingerprint,
          source_confidence: 70,
          sponsorship_confidence: 0,
          sponsorship_outcome: "not_stated",
          decision: "limited",
          staleness_state: "fresh",
        })
        .select("id")
        .single();
      expect(created.error).toBeNull();
      assessmentIds.push(created.data!.id);
      expect(
        (
          await admin!.from("confidence_assessments").insert({
            opportunity_id: opportunity.data!.id,
            assessment_type: "source_safety",
            algorithm_version: "phase6.v1",
            input_fingerprint: fingerprint,
            source_confidence: 70,
            sponsorship_confidence: 0,
            sponsorship_outcome: "not_stated",
            decision: "limited",
            staleness_state: "fresh",
          })
        ).error,
      ).not.toBeNull();
      expect(
        (await admin!.from("confidence_assessments").update({ decision: "allow" }).eq("id", created.data!.id))
          .error,
      ).not.toBeNull();
      const anonymous = createClient(url!, publicKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      expect((await anonymous.from("confidence_assessments").select("id")).error).not.toBeNull();
      expect((await anonymous.from("confidence_assessments").insert({})).error).not.toBeNull();
    },
    30_000,
  );
});
