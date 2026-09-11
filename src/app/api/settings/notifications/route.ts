import { NextResponse, type NextRequest } from "next/server";
import { getPolicyVersion } from "@/server/auth/constants";
import { issueMessages } from "@/server/auth/schemas";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { getCurrentUser } from "@/server/auth/service";
import { notificationPreferenceRequestSchema } from "@/server/notifications/model";

export async function POST(request: NextRequest) {
  const parsed = notificationPreferenceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: issueMessages(parsed.error) }, { status: 400 });
  const response = NextResponse.json({ ok: true, message: "Notification preferences saved." });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const saved = await client.rpc("phase11_save_notification_preferences", {
    candidate_email_frequency: parsed.data.email_frequency,
    candidate_telegram_frequency: parsed.data.telegram_frequency,
    candidate_timezone_name: parsed.data.timezone_name,
    candidate_quiet_hours_enabled: parsed.data.quiet_hours_enabled,
    candidate_quiet_hours_start: parsed.data.quiet_hours_start,
    candidate_quiet_hours_end: parsed.data.quiet_hours_end,
    candidate_event_types: parsed.data.event_types,
    email_consent: parsed.data.email_consent,
    telegram_consent: parsed.data.telegram_consent,
    candidate_policy_version: getPolicyVersion(),
  });
  if (saved.error) {
    const message = saved.error.message.includes("verified email")
      ? "Verify your email before enabling email alerts."
      : saved.error.message.includes("Telegram link")
        ? "Link Telegram before enabling Telegram alerts."
        : saved.error.message.includes("consent")
          ? "Confirm channel consent before enabling alerts."
          : "We could not save your preferences.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return response;
}
