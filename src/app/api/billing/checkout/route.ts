import { NextResponse, type NextRequest } from "next/server";
import { checkoutRequestSchema } from "@/server/billing/model";
import { initializeCheckout } from "@/server/billing/service";
import { BillingProviderError } from "@/server/billing/provider";
import { getCurrentUser } from "@/server/auth/service";
import { InMemoryFixedWindowRateLimiter } from "@/server/security/rate-limit";
import { getRequestIdentifier } from "@/server/security/request";
import { createSupabaseRouteClient } from "@/server/supabase/route";

const limiter = new InMemoryFixedWindowRateLimiter();

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in to choose a plan." }, { status: 401 });
  if (!limiter.check(`${user.id}:${getRequestIdentifier(request)}`, 4, 5 * 60_000).allowed)
    return NextResponse.json(
      { error: "A checkout was recently started. Wait before trying again." },
      { status: 429 },
    );
  const parsed = checkoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Choose Weekly, Monthly or Yearly." }, { status: 400 });
  try {
    const checkout = await initializeCheckout({ user, ...parsed.data });
    return NextResponse.json({ ok: true, ...checkout }, { headers: response.headers });
  } catch (error) {
    if (error instanceof BillingProviderError && error.code === "PROVIDER_DISABLED")
      return NextResponse.json(
        { error: "Secure payments are not configured yet. No charge was attempted." },
        { status: 503 },
      );
    const message = error instanceof Error ? error.message : "";
    if (message === "VERIFIED_EMAIL_REQUIRED")
      return NextResponse.json({ error: "Verify your account email before checkout." }, { status: 403 });
    if (message === "PROVIDER_PLAN_MISMATCH")
      return NextResponse.json(
        { error: "This plan is temporarily unavailable while its secure price is checked." },
        { status: 409 },
      );
    return NextResponse.json(
      { error: "Checkout could not be started. No charge was made." },
      { status: 503 },
    );
  }
}
