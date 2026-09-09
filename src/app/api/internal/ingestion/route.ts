import { NextResponse } from "next/server";
import { parseServerEnvironment } from "@/lib/env/schema";
import { createLogger } from "@/server/logging";
import { isCronRequestAuthorized } from "@/server/security/cron-auth";
import { getCorrelationId } from "@/server/security/request";

export const dynamic = "force-dynamic";

// Scheduling is deliberately an authenticated boundary only. Deployment configuration must enable
// it after approved source policies and a server-side adapter runner are configured.
export async function POST(request: Request): Promise<NextResponse> {
  const env = parseServerEnvironment();
  const correlationId = getCorrelationId(request);
  if (!isCronRequestAuthorized(request, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized", correlationId }, { status: 401 });
  }
  if (env.INGESTION_CRON_ENABLED !== "true") {
    return NextResponse.json({ status: "disabled", correlationId }, { status: 503 });
  }
  createLogger({ correlationId }).info("ingestion_schedule_invoked", {
    stage: "schedule",
    maxSources: env.INGESTION_MAX_SOURCES ?? 4,
  });
  return NextResponse.json({ status: "accepted", correlationId }, { status: 202 });
}
