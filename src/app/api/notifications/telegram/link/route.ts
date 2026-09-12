import { NextResponse, type NextRequest } from "next/server";
import { parseServerEnvironment } from "@/lib/env/schema";
import { getCurrentUser, hasCurrentConsent, recordAudit } from "@/server/auth/service";
import { createTelegramLinkSecret, telegramLinkUrl } from "@/server/notifications/service";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!(await consumeRateLimit("telegram.link", user.id, 5, 60 * 60_000)).allowed)
    return NextResponse.json({ error: "Please wait before creating another link." }, { status: 429 });
  if (!(await hasCurrentConsent(client, user.id, "telegram_notifications")))
    return NextResponse.json(
      { error: "Telegram alert consent is required before linking." },
      { status: 409 },
    );
  const env = parseServerEnvironment();
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_BOT_USERNAME || !env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Telegram linking is not configured yet.", code: "PROVIDER_DISABLED" },
      { status: 503 },
    );
  }
  const secret = createTelegramLinkSecret();
  const linked = await client.rpc("phase11_create_telegram_link_token", { token_digest: secret.digest });
  if (linked.error)
    return NextResponse.json({ error: "A secure Telegram link could not be created." }, { status: 500 });
  await recordAudit(client, user.id, "telegram_link_started");
  return NextResponse.json({
    ok: true,
    url: telegramLinkUrl(env.TELEGRAM_BOT_USERNAME, secret.token),
    expiresInSeconds: 900,
  });
}
