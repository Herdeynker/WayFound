import { NextResponse, type NextRequest } from "next/server";
import { cvAnalysisRequestSchema } from "@/server/assistant/model";
import { runCvAnalysis } from "@/server/assistant/service";
import { getCurrentUser, hasCurrentConsent } from "@/server/auth/service";
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
  if (!(await hasCurrentConsent(client, user.id, "ai_processing")))
    return NextResponse.json(
      { error: "AI processing consent is required before CV analysis." },
      { status: 403 },
    );
  if (!limiter.check(`${user.id}:${getRequestIdentifier(request)}`, 6, 60_000).allowed)
    return NextResponse.json(
      { error: "Too many analysis requests. Wait a minute and try again." },
      { status: 429 },
    );
  const parsed = cvAnalysisRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Provide a valid application and CV text between 200 and 50,000 characters." },
      { status: 400 },
    );
  try {
    const result = await runCvAnalysis({
      userId: user.id,
      applicationId: parsed.data.applicationId,
      cvText: parsed.data.text,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: cookieResponse.headers });
  } catch {
    return NextResponse.json(
      { error: "The CV could not be analysed. Nothing was changed." },
      { status: 400 },
    );
  }
}
