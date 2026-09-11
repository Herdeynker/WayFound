import { NextResponse, type NextRequest } from "next/server";
import { cancelSubscriptionRenewal } from "@/server/billing/service";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  try {
    return NextResponse.json(
      { ok: true, ...(await cancelSubscriptionRenewal({ userId: user.id })) },
      { headers: response.headers },
    );
  } catch (error) {
    const management = error instanceof Error && error.message === "MANAGEMENT_LINK_REQUIRED";
    return NextResponse.json(
      {
        error: management
          ? "Use the secure Paystack management page to stop renewal."
          : "Renewal could not be changed. Your current access is unchanged.",
        management,
      },
      { status: management ? 409 : 503 },
    );
  }
}
