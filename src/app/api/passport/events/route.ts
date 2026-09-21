import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { onboardingFlowVersion, onboardingStageIds } from "@/features/passport/model";
import { analyticsIdempotencyKey, recordProductEvent } from "@/server/analytics";
import { getCurrentUser, hasCurrentRequiredConsent } from "@/server/auth/service";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { createSupabaseRouteClient } from "@/server/supabase/route";

const eventTypes = [
  "onboarding_started",
  "onboarding_stage_viewed",
  "onboarding_stage_completed",
  "onboarding_stage_abandoned",
  "onboarding_resumed",
  "optional_field_deferred",
  "review_edit_requested",
  "onboarding_focus_path_viewed",
  "onboarding_focus_path_selected",
  "onboarding_focus_path_changed",
  "onboarding_exploring_selected",
  "onboarding_deferred_path",
] as const;

const details = [
  "academic_details",
  "passport_enrichment",
  "goals_destinations",
  "background",
  "experience",
  "selection",
  "academic",
  "professional",
  "trade",
  "exploring",
] as const;

const schema = z.object({
  eventType: z.enum(eventTypes),
  stage: z.enum(onboardingStageIds),
  detail: z.enum(details).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid onboarding event." }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await hasCurrentRequiredConsent(client, user.id)))
    return NextResponse.json({ error: "Required privacy choices must be confirmed first." }, { status: 403 });
  if (!(await consumeRateLimit("passport.analytics", user.id, 80, 60_000)).allowed)
    return NextResponse.json({ error: "Too many event updates." }, { status: 429 });
  const progress = await client
    .from("onboarding_progress")
    .select("revision")
    .eq("user_id", user.id)
    .maybeSingle();
  const revision = progress.data?.revision ?? 0;
  await recordProductEvent({
    userId: user.id,
    eventType: parsed.data.eventType,
    idempotencyKey: analyticsIdempotencyKey(
      parsed.data.eventType,
      `${user.id}:${parsed.data.stage}:${parsed.data.detail ?? "none"}:${revision}`,
    ),
    properties: {
      stage: parsed.data.stage,
      flow_version: onboardingFlowVersion,
      detail: parsed.data.detail,
    },
  });
  return NextResponse.json({ ok: true }, { headers: response.headers });
}
