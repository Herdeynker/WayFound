import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { getCurrentUser, recordAudit } from "@/server/auth/service";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    ok: true,
    message: "Your export request is queued. We will make the result available when processing completes.",
  });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!(await consumeRateLimit("account.export", user.id, 3, 24 * 60 * 60_000)).allowed)
    return NextResponse.json(
      { error: "An export was recently requested. Please wait before retrying." },
      { status: 429 },
    );
  const { data: active } = await client
    .from("data_export_requests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (!active) {
    const { error } = await client.from("data_export_requests").insert({ user_id: user.id });
    if (error)
      return NextResponse.json({ error: "We could not queue your export request." }, { status: 500 });
    await recordAudit(client, user.id, "data_export_requested");
  }
  return response;
}
