import { NextResponse, type NextRequest } from "next/server";
import { createSubscriptionManagementLink } from "@/server/billing/service";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  try {
    return NextResponse.json(
      { ok: true, url: await createSubscriptionManagementLink({ userId: user.id }) },
      { headers: response.headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Secure payment management is temporarily unavailable." },
      { status: 503 },
    );
  }
}
