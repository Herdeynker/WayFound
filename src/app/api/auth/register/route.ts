import { NextResponse, type NextRequest } from "next/server";
import { getAppUrl } from "@/server/supabase/config";
import { rateLimitAuth } from "@/server/auth/route";
import { credentialsSchema, issueMessages } from "@/server/auth/schemas";
import { bootstrapAccount, hasCurrentRequiredConsent, recordAudit } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest) {
  const limited = rateLimitAuth(request, "register");
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: issueMessages(parsed.error) }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const { data, error } = await client.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { first_name: parsed.data.firstName ?? "" },
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=/consent`,
    },
  });
  if (error || !data.user)
    return NextResponse.json(
      { error: "We could not create that account. Please check your details and try again." },
      { status: 400 },
    );
  if (data.session) {
    await bootstrapAccount(client, data.user);
    await recordAudit(client, data.user.id, "account_registered");
  }
  return NextResponse.json(
    {
      ok: true,
      redirectTo:
        data.session && (await hasCurrentRequiredConsent(client, data.user.id))
          ? "/dashboard"
          : "/auth/verify?mode=register",
    },
    { headers: response.headers },
  );
}
