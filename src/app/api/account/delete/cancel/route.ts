import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { getCurrentUser, recordAudit } from "@/server/auth/service";

export async function POST(request: NextRequest) {
  const requestId = ((await request.json().catch(() => ({}))) as { requestId?: unknown }).requestId;
  if (typeof requestId !== "string")
    return NextResponse.json({ error: "A deletion request is required." }, { status: 400 });
  const response = NextResponse.json({ ok: true, message: "Your deletion request was cancelled." });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { data, error } = await client.rpc("cancel_account_deletion_request", { request_id: requestId });
  if (error || !data)
    return NextResponse.json({ error: "That request cannot be cancelled now." }, { status: 409 });
  await recordAudit(client, user.id, "account_deletion_cancelled");
  return response;
}
