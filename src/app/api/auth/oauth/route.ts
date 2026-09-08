import { NextResponse, type NextRequest } from "next/server";
import { getSafeRedirectPath } from "@/server/security/redirect";
import { getAppUrl } from "@/server/supabase/config";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function GET(request: NextRequest) {
  const enabled =
    process.env.GOOGLE_OAUTH_ENABLED === "true" || process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true";
  if (!enabled)
    return NextResponse.json(
      { error: "Google sign-in is not enabled for this environment yet." },
      { status: 503 },
    );
  const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"), "/dashboard");
  const response = NextResponse.redirect(new URL("/login?oauth=starting", request.url));
  const client = createSupabaseRouteClient(request, response);
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  return NextResponse.redirect(data.url, { headers: response.headers });
}
