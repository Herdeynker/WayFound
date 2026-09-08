import { NextResponse, type NextRequest } from "next/server";
import { getSafeRedirectPath } from "@/server/security/redirect";
import { rateLimitAuth } from "@/server/auth/route";
import { credentialsSchema, issueMessages } from "@/server/auth/schemas";
import { bootstrapAccount, hasCurrentRequiredConsent, recordAudit } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest) {
  const limited = rateLimitAuth(request, "login");
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: issueMessages(parsed.error) }, { status: 400 });

  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const { data, error } = await client.auth.signInWithPassword(parsed.data);
  if (error || !data.user)
    return NextResponse.json({ error: "Those sign-in details were not accepted." }, { status: 401 });
  await bootstrapAccount(client, data.user);
  await recordAudit(client, data.user.id, "account_login");
  const next =
    typeof (body as { next?: unknown })?.next === "string" ? (body as { next: string }).next : null;
  const destination = (await hasCurrentRequiredConsent(client, data.user.id))
    ? getSafeRedirectPath(next, "/dashboard")
    : "/consent";
  return NextResponse.json({ ok: true, redirectTo: destination }, { headers: response.headers });
}
