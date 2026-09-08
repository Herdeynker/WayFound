import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { getCurrentUser, recordAudit } from "@/server/auth/service";

const schema = z.object({ password: z.string().min(8).max(128) });
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Choose a password with at least 8 characters." }, { status: 400 });
  const response = NextResponse.json({ ok: true, redirectTo: "/login?reset=success" });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "This recovery link is invalid or expired." }, { status: 401 });
  const { error } = await client.auth.updateUser({ password: parsed.data.password });
  if (error)
    return NextResponse.json({ error: "This recovery link is invalid or expired." }, { status: 401 });
  await recordAudit(client, user.id, "password_reset");
  return response;
}
