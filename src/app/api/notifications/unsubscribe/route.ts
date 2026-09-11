import { NextResponse, type NextRequest } from "next/server";
import { getPolicyVersion } from "@/server/auth/constants";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true, message: "Email alerts are off." });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const saved = await client.rpc("phase11_unsubscribe_email", {
    candidate_policy_version: getPolicyVersion(),
  });
  if (saved.error) return NextResponse.json({ error: "Email alerts could not be changed." }, { status: 500 });
  return response;
}
