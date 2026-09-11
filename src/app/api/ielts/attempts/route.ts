import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

const startSchema = z
  .object({
    contentId: z.string().uuid(),
    attemptKind: z.enum(["diagnostic", "practice"]),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
const interruptSchema = z
  .object({ attemptId: z.string().uuid(), elapsedSeconds: z.number().int().min(0).max(7200) })
  .strict();

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Choose an approved IELTS activity." }, { status: 400 });
  const result = await client.rpc("phase13_start_attempt", {
    candidate_content_id: parsed.data.contentId,
    candidate_attempt_kind: parsed.data.attemptKind,
    candidate_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error || !result.data)
    return NextResponse.json(
      { error: "This activity is unavailable for your current IELTS setup." },
      { status: 409 },
    );
  return NextResponse.json({ ok: true, attemptId: result.data }, { headers: response.headers });
}

export async function PATCH(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const parsed = interruptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "The interrupted attempt could not be identified." }, { status: 400 });
  const result = await client.rpc("phase13_set_attempt_interrupted", {
    candidate_attempt_id: parsed.data.attemptId,
    candidate_elapsed_seconds: parsed.data.elapsedSeconds,
  });
  if (result.error || !result.data)
    return NextResponse.json({ error: "This attempt could not be paused." }, { status: 409 });
  return NextResponse.json({ ok: true }, { headers: response.headers });
}
