import { NextResponse } from "next/server";
import { parseServerEnvironment } from "@/lib/env/schema";
import { parseDiscoveryConfiguration } from "@/server/discovery/model";
import { DiscoveryUnavailableError, scheduleKnownSourceMonitoring } from "@/server/discovery/service";
import { SupabaseDiscoveryStore } from "@/server/discovery/store";
import { createLogger } from "@/server/logging";
import { isCronRequestAuthorized } from "@/server/security/cron-auth";
import { getCorrelationId } from "@/server/security/request";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const env = parseServerEnvironment();
  const correlationId = getCorrelationId(request);
  if (!isCronRequestAuthorized(request, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized", correlationId }, { status: 401 });
  }
  if (env.INGESTION_CRON_ENABLED !== "true") {
    return NextResponse.json({ status: "disabled", correlationId }, { status: 503 });
  }
  const logger = createLogger({ correlationId });
  try {
    const result = await scheduleKnownSourceMonitoring({
      store: new SupabaseDiscoveryStore(createSupabaseAdminClient()),
      config: parseDiscoveryConfiguration(),
      maxSources: env.INGESTION_MAX_SOURCES ?? 4,
    });
    logger.info("known_source_monitoring_scheduled", result);
    return NextResponse.json({ status: "completed", result, correlationId }, { status: 200 });
  } catch (error) {
    if (error instanceof DiscoveryUnavailableError)
      return NextResponse.json({ status: error.state, correlationId }, { status: 503 });
    logger.error("known_source_monitoring_failed", { error });
    return NextResponse.json(
      { status: "failed", error: "Known-source monitoring failed safely", correlationId },
      { status: 500 },
    );
  }
}

export const GET = POST;
