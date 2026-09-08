import { NextResponse, type NextRequest } from "next/server";
import { preferencesSchema, issueMessages } from "@/server/auth/schemas";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { getCurrentUser } from "@/server/auth/service";

export async function POST(request: NextRequest) {
  const parsed = preferencesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: issueMessages(parsed.error) }, { status: 400 });
  const response = NextResponse.json({ ok: true, message: "Notification preferences saved." });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { error } = await client
    .from("notification_preferences")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "We could not save your preferences." }, { status: 500 });
  return response;
}
