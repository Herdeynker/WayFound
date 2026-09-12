import { NextResponse, type NextRequest } from "next/server";
import { getAppUrl } from "@/server/supabase/config";
import { rateLimitAuth } from "@/server/auth/route";
import { emailSchema, issueMessages } from "@/server/auth/schemas";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest) {
  const limited = await rateLimitAuth(request, "magic-link");
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = emailSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: issueMessages(parsed.error) }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const { error } = await client.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true, emailRedirectTo: `${getAppUrl()}/auth/callback?next=/consent` },
  });
  if (error)
    return NextResponse.json(
      { error: "We could not send that link. Please try again shortly." },
      { status: 400 },
    );
  return NextResponse.json(
    { ok: true, message: "If that address can receive WayFound mail, a sign-in link is on its way." },
    { headers: response.headers },
  );
}
