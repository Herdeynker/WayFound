import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { getCurrentUser, recordAudit } from "@/server/auth/service";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true, redirectTo: "/login?logged_out=1" });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  const all = request.headers.get("content-type")?.includes("application/json")
    ? Boolean(((await request.json().catch(() => ({}))) as { all?: unknown }).all)
    : false;
  if (user) await recordAudit(client, user.id, all ? "account_logout_all" : "account_logout");
  const { error } = await client.auth.signOut({ scope: all ? "global" : "local" });
  if (error)
    return NextResponse.json({ error: "We could not sign you out. Please try again." }, { status: 400 });
  return response;
}
