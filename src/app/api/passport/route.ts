import { NextResponse, type NextRequest } from "next/server";
import { passportStateSchema } from "@/features/passport/model";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { confirmPassport, getPassportDraft, savePassportDraft } from "@/server/passport/service";
import { analyticsIdempotencyKey, recordProductEvent } from "@/server/analytics";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  try {
    return NextResponse.json(await getPassportDraft(client, user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "We could not load your Passport." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    state?: unknown;
    currentSection?: string;
    confirm?: boolean;
  } | null;
  const parsed = passportStateSchema.safeParse(body?.state);
  if (!parsed.success)
    return NextResponse.json({ error: "Please review the fields before saving." }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!(await consumeRateLimit("passport.save", user.id, 40, 60_000)).allowed)
    return NextResponse.json(
      { error: "Too many Passport updates. Wait a minute and retry." },
      { status: 429 },
    );
  try {
    if (body?.confirm) {
      const completion = await confirmPassport(client, user.id, parsed.data);
      await recordProductEvent({
        userId: user.id,
        eventType: "onboarding_completed",
        idempotencyKey: analyticsIdempotencyKey("onboarding_completed", user.id),
        properties: { pathway: parsed.data.selectedGoals.join("+").slice(0, 80) },
      });
      return NextResponse.json({ ok: true, completion });
    }
    return NextResponse.json({
      ok: true,
      ...(await savePassportDraft(client, user.id, parsed.data, body?.currentSection ?? "goals")),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "We could not save your Passport." },
      { status: 500 },
    );
  }
}
