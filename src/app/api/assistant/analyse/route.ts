import { NextResponse, type NextRequest } from "next/server";
import { cvAnalysisRequestSchema } from "@/server/assistant/model";
import { runCvAnalysis } from "@/server/assistant/service";
import { getCurrentUser, hasCurrentConsent } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getRequestIdentifier } from "@/server/security/request";
import { randomUUID } from "node:crypto";
import { BillingAccessError, requirePaidFeature } from "@/server/billing/service";

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
  if (
    !(await consumeRateLimit("assistant.analyse", `${user.id}:${getRequestIdentifier(request)}`, 6, 60_000))
      .allowed
  )
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
    await requirePaidFeature(client, "cv_analysis", randomUUID());
  } catch (error) {
    const limited = error instanceof BillingAccessError && error.code === "USAGE_LIMIT_REACHED";
    return NextResponse.json(
      {
        error: limited
          ? "Your CV analysis allowance is used for this paid period."
          : "A verified paid plan is required for CV analysis.",
      },
      { status: limited ? 429 : 402 },
    );
  }
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
