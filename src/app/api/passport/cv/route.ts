import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, hasCurrentConsent } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { requestCvSuggestions } from "@/server/passport/cv";
import { ProviderDisabledError } from "@/server/providers";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!(await hasCurrentConsent(client, user.id, "ai_processing")))
    return NextResponse.json(
      { error: "AI processing consent is required before CV parsing." },
      { status: 403 },
    );
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  if (typeof body?.text !== "string" || !body.text.trim())
    return NextResponse.json(
      { error: "Provide the extracted CV text to request suggestions." },
      { status: 400 },
    );
  try {
    const suggestions = await requestCvSuggestions({ text: body.text, consentGranted: true });
    return NextResponse.json({ ok: true, suggestions });
  } catch (error) {
    if (error instanceof ProviderDisabledError)
      return NextResponse.json(
        {
          error: "CV suggestions are not available yet because the AI provider is disabled.",
          code: "PROVIDER_DISABLED",
        },
        { status: 503 },
      );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CV suggestions could not be created." },
      { status: 400 },
    );
  }
}
