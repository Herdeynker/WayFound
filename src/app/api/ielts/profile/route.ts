import { NextResponse, type NextRequest } from "next/server";
import { ieltsProfileSchema } from "@/features/ielts/model";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest) {
  const cookieResponse = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, cookieResponse);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const parsed = ieltsProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review your test type, target band, date and recording retention choice." },
      { status: 400 },
    );
  if (parsed.data.testDate && parsed.data.testDate < new Date().toISOString().slice(0, 10))
    return NextResponse.json({ error: "Choose today or a future test date." }, { status: 400 });
  const saved = await client.from("ielts_profiles").upsert(
    {
      user_id: user.id,
      test_type: parsed.data.testType,
      target_band: parsed.data.targetBand,
      test_date: parsed.data.testDate,
      recording_retention_days: parsed.data.recordingRetentionDays,
    },
    { onConflict: "user_id" },
  );
  if (saved.error)
    return NextResponse.json({ error: "Your IELTS setup could not be saved. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: cookieResponse.headers });
}
