import { NextResponse, type NextRequest } from "next/server";
import { deletionConfirmationSchema } from "@/server/auth/schemas";
import { getDeletionGraceDays } from "@/server/auth/constants";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { getCurrentUser, recordAudit } from "@/server/auth/service";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = deletionConfirmationSchema.safeParse(body.confirmation ? body : { confirmation: "DELETE" });
  if (!parsed.success)
    return NextResponse.json({ error: "Explicit confirmation is required." }, { status: 400 });
  const response = NextResponse.json({
    ok: true,
    message: "Your deletion request is queued and can be cancelled during the grace period.",
  });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!(await consumeRateLimit("account.delete", user.id, 3, 24 * 60 * 60_000)).allowed)
    return NextResponse.json(
      { error: "A deletion request was recently handled. Please wait before retrying." },
      { status: 429 },
    );
  const grace = new Date(Date.now() + getDeletionGraceDays() * 86_400_000).toISOString();
  const { data: active } = await client
    .from("account_deletion_requests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (!active) {
    const { error } = await client
      .from("account_deletion_requests")
      .insert({ user_id: user.id, grace_period_ends_at: grace });
    if (error)
      return NextResponse.json({ error: "We could not queue your deletion request." }, { status: 500 });
    await recordAudit(client, user.id, "account_deletion_requested", { grace_days: getDeletionGraceDays() });
  }
  return response;
}
