import { NextResponse, type NextRequest } from "next/server";
import { feedbackRequestSchema } from "@/features/ielts/model";
import { getCurrentUser, hasCurrentConsent } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { InMemoryFixedWindowRateLimiter } from "@/server/security/rate-limit";
import { getRequestIdentifier } from "@/server/security/request";
import { ProviderDisabledError } from "@/server/providers";
import { createEstimatedFeedback } from "@/server/ielts/service";

const limiter = new InMemoryFixedWindowRateLimiter();

export async function POST(request: NextRequest) {
  const cookieResponse = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, cookieResponse);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!(await hasCurrentConsent(client, user.id, "ai_processing")))
    return NextResponse.json(
      { error: "AI processing consent is required for estimated feedback." },
      { status: 403 },
    );
  if (!limiter.check(`${user.id}:${getRequestIdentifier(request)}`, 8, 60_000).allowed)
    return NextResponse.json(
      { error: "Too many feedback requests. Wait a minute and retry." },
      { status: 429 },
    );
  const parsed = feedbackRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Review the practice response." },
      { status: 400 },
    );
  try {
    const result = await createEstimatedFeedback({ userId: user.id, userClient: client, ...parsed.data });
    return NextResponse.json({ ok: true, ...result }, { headers: cookieResponse.headers });
  } catch (error) {
    if (error instanceof ProviderDisabledError)
      return NextResponse.json(
        { error: "Estimated feedback is not configured. Your practice remains available to retry." },
        { status: 503 },
      );
    const code = error instanceof Error ? error.message : "FEEDBACK_FAILED";
    return NextResponse.json(
      {
        error:
          code === "FEEDBACK_REJECTED"
            ? "The feedback response was malformed and was rejected. Your practice remains available to retry."
            : "Estimated feedback could not be completed. Nothing was marked complete.",
      },
      { status: code === "FEEDBACK_REJECTED" ? 422 : 409 },
    );
  }
}
