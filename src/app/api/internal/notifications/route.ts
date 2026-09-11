import { NextResponse } from "next/server";
import { parseServerEnvironment } from "@/lib/env/schema";
import { runNotificationBatch } from "@/server/notifications/service";
import { createConfiguredNotificationProviders } from "@/server/notifications/providers";
import { isCronRequestAuthorized } from "@/server/security/cron-auth";
import { getCorrelationId } from "@/server/security/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const env = parseServerEnvironment();
  const correlationId = getCorrelationId(request);
  if (!isCronRequestAuthorized(request, env.CRON_SECRET))
    return NextResponse.json({ error: "Unauthorized", correlationId }, { status: 401 });
  if (env.NOTIFICATIONS_CRON_ENABLED !== "true")
    return NextResponse.json({ status: "disabled", correlationId }, { status: 503 });
  try {
    const result = await runNotificationBatch({
      appUrl: env.APP_URL ?? "",
      ...createConfiguredNotificationProviders(),
      limit: env.NOTIFICATION_BATCH_SIZE ?? 25,
    });
    return NextResponse.json({ status: "completed", correlationId, ...result });
  } catch {
    return NextResponse.json(
      { error: "Notification delivery could not complete.", correlationId },
      { status: 503 },
    );
  }
}
