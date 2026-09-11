import { NextResponse, type NextRequest } from "next/server";
import { readingSubmissionSchema } from "@/features/ielts/model";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { InMemoryFixedWindowRateLimiter } from "@/server/security/rate-limit";
import { getRequestIdentifier } from "@/server/security/request";

const limiter = new InMemoryFixedWindowRateLimiter();

export async function POST(request: NextRequest) {
  const cookieResponse = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, cookieResponse);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!limiter.check(`${user.id}:${getRequestIdentifier(request)}`, 20, 60_000).allowed)
    return NextResponse.json(
      { error: "Too many practice submissions. Wait a minute and retry." },
      { status: 429 },
    );
  const parsed = readingSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Complete the reading task with valid answers." }, { status: 400 });
  const started = await client.rpc("phase13_start_attempt", {
    candidate_content_id: parsed.data.contentId,
    candidate_attempt_kind: parsed.data.attemptKind,
    candidate_idempotency_key: parsed.data.idempotencyKey,
  });
  if (started.error || !started.data)
    return NextResponse.json(
      { error: "This approved diagnostic is unavailable for your test type." },
      { status: 409 },
    );
  const scored = await client.rpc("phase13_submit_reading", {
    candidate_attempt_id: started.data,
    candidate_answers: parsed.data.answers,
    candidate_elapsed_seconds: parsed.data.elapsedSeconds,
  });
  if (scored.error)
    return NextResponse.json(
      { error: "Your answers could not be scored. They were not marked complete." },
      { status: 422 },
    );
  return NextResponse.json({ ok: true, result: scored.data }, { headers: cookieResponse.headers });
}
