import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseRouteClient } from "@/server/supabase/route";

const feedbackSchema = z
  .object({
    matchId: z.string().uuid(),
    eventType: z.enum([
      "match_saved",
      "match_unsaved",
      "match_dismissed",
      "match_useful",
      "match_not_useful",
      "match_viewed",
    ]),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid feedback request." }, { status: 400 });
  const result = await client.from("match_feedback_events").insert({
    user_id: user.id,
    match_evaluation_id: parsed.data.matchId,
    event_type: parsed.data.eventType,
    idempotency_key: parsed.data.idempotencyKey,
    metadata: {},
  });
  if (result.error?.code === "23505") return response;
  if (result.error) return NextResponse.json({ error: "We could not save that change." }, { status: 500 });
  return response;
}
