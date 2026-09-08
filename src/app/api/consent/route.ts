import { NextResponse, type NextRequest } from "next/server";
import { consentSchema, issueMessages } from "@/server/auth/schemas";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { getCurrentUser, hasCurrentRequiredConsent, recordConsent } from "@/server/auth/service";

export async function POST(request: NextRequest) {
  const parsed = consentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: issueMessages(parsed.error) }, { status: 400 });
  if (!parsed.data.profile_matching || !parsed.data.ai_processing || !parsed.data.document_storage)
    return NextResponse.json(
      { error: "The three required choices must be selected to continue." },
      { status: 400 },
    );
  const response = NextResponse.json({ ok: true, redirectTo: "/dashboard" });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const result = await recordConsent(client, user.id, parsed.data);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return (await hasCurrentRequiredConsent(client, user.id))
    ? response
    : NextResponse.json({ error: "Required choices could not be confirmed." }, { status: 500 });
}
