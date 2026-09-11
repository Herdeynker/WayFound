import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, recordAudit } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true, message: "Telegram has been unlinked." });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const unlinked = await client.rpc("phase11_unlink_telegram");
  if (unlinked.error) return NextResponse.json({ error: "Telegram could not be unlinked." }, { status: 500 });
  await recordAudit(client, user.id, "telegram_unlinked");
  return response;
}
