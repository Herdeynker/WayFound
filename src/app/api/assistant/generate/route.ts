import { NextResponse, type NextRequest } from "next/server";
import { generationRequestSchema } from "@/server/assistant/model";
import { generateApplicationDraft } from "@/server/assistant/service";
import { getCurrentUser, hasCurrentConsent } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { InMemoryFixedWindowRateLimiter } from "@/server/security/rate-limit";
import { getRequestIdentifier } from "@/server/security/request";

const limiter = new InMemoryFixedWindowRateLimiter();

const safeGenerationError = (code: string) => {
  if (code === "PROVIDER_DISABLED")
    return [
      "Writing assistance is not configured yet. Your approved facts and draft setup were saved.",
      503,
    ] as const;
  if (code === "PROVIDER_TIMEOUT")
    return [
      "The writing provider took too long. Retry with the same draft when you are ready.",
      504,
    ] as const;
  if (code === "GROUNDING_REJECTED")
    return [
      "The draft was rejected because it was not fully supported by your approved facts.",
      422,
    ] as const;
  if (code === "QUOTA_REACHED")
    return ["Your daily writing limit has been reached. Existing drafts remain available.", 429] as const;
  if (code === "RETRY_LIMIT_REACHED")
    return ["This request reached its retry limit. Start a new draft when you are ready.", 409] as const;
  return ["The draft could not be created. Your existing work is unchanged.", 400] as const;
};

export async function POST(request: NextRequest) {
  const cookieResponse = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, cookieResponse);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!(await hasCurrentConsent(client, user.id, "ai_processing")))
    return NextResponse.json(
      { error: "AI processing consent is required before drafting." },
      { status: 403 },
    );
  if (!limiter.check(`${user.id}:${getRequestIdentifier(request)}`, 8, 60_000).allowed)
    return NextResponse.json(
      { error: "Too many writing requests. Wait a minute and try again." },
      { status: 429 },
    );
  const parsed = generationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review the application, facts, tone and word limit before generating." },
      { status: 400 },
    );
  try {
    const result = await generateApplicationDraft({ userId: user.id, userClient: client, ...parsed.data });
    return NextResponse.json({ ok: true, ...result }, { headers: cookieResponse.headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "GENERATION_FAILED";
    const [message, status] = safeGenerationError(code);
    return NextResponse.json({ error: message }, { status });
  }
}
