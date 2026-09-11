import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { parseServerEnvironment } from "@/lib/env/schema";
import { telegramTokenDigest, telegramUpdateSchema } from "@/server/notifications/model";
import { createConfiguredNotificationProviders } from "@/server/notifications/providers";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(request: Request, expected?: string): boolean {
  if (!expected) return false;
  const supplied = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const actualBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function POST(request: Request) {
  const env = parseServerEnvironment();
  if (!authorized(request, env.TELEGRAM_WEBHOOK_SECRET))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = telegramUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });
  const text = parsed.data.message?.text ?? "";
  const match = /^\/start\s+([A-Za-z0-9_-]{20,80})$/.exec(text);
  if (!match || !parsed.data.message) return NextResponse.json({ ok: true });
  const admin = createSupabaseAdminClient();
  const label = parsed.data.message.from?.username ?? parsed.data.message.from?.first_name ?? null;
  const result = await admin.rpc("phase11_consume_telegram_link_token", {
    token_digest: telegramTokenDigest(match[1]),
    candidate_chat_id: String(parsed.data.message.chat.id),
    candidate_display_label: label ?? undefined,
  });
  if (result.error) return NextResponse.json({ ok: true });
  const providers = createConfiguredNotificationProviders();
  await providers.telegram
    .sendMessage(
      String(parsed.data.message.chat.id),
      "Telegram is linked to WAYFOUND. You control alerts in Settings.",
    )
    .catch(() => undefined);
  return NextResponse.json({ ok: true });
}
