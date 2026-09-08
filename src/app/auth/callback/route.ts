import { NextResponse, type NextRequest } from "next/server";
import { getSafeRedirectPath } from "@/server/security/redirect";
import {
  getCurrentUser,
  bootstrapAccount,
  hasCurrentRequiredConsent,
  recordAudit,
} from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const errorCode = request.nextUrl.searchParams.get("error_code");
  if (error || errorCode) return NextResponse.redirect(new URL("/login?error=oauth_cancelled", request.url));
  if (!code) return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));

  const response = NextResponse.redirect(new URL("/consent", request.url));
  const client = createSupabaseRouteClient(request, response);
  const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  if (exchangeError) return NextResponse.redirect(new URL("/login?error=expired_link", request.url));
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  await bootstrapAccount(client, user);
  await recordAudit(client, user.id, "email_verification_requested", { method: "callback" });
  const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"), "/dashboard");
  const destination = (await hasCurrentRequiredConsent(client, user.id)) ? next : "/consent";
  return NextResponse.redirect(new URL(destination, request.url), { headers: response.headers });
}
