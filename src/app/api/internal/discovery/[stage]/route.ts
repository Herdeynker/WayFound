import { NextResponse } from "next/server";
import { parseServerEnvironment } from "@/lib/env/schema";
import { parseDiscoveryConfiguration } from "@/server/discovery/model";
import { DiscoveryUnavailableError, runDiscoveryStage } from "@/server/discovery/service";
import { SupabaseDiscoveryStore } from "@/server/discovery/store";
import { discoveryStages, type DiscoveryStage } from "@/server/discovery/types";
import { createLogger } from "@/server/logging";
import { isCronRequestAuthorized } from "@/server/security/cron-auth";
import { getCorrelationId } from "@/server/security/request";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const isStage = (value: string): value is DiscoveryStage =>
  (discoveryStages as readonly string[]).includes(value);

async function handle(request: Request, context: { params: Promise<{ stage: string }> }) {
  const correlationId = getCorrelationId(request);
  const env = parseServerEnvironment();
  if (!isCronRequestAuthorized(request, env.CRON_SECRET))
    return NextResponse.json({ error: "Unauthorized", correlationId }, { status: 401 });
  const { stage } = await context.params;
  if (!isStage(stage))
    return NextResponse.json({ error: "Unknown discovery stage", correlationId }, { status: 404 });
  const config = parseDiscoveryConfiguration();
  const logger = createLogger({ correlationId });
  try {
    const result = await runDiscoveryStage({
      stage,
      config,
      store: new SupabaseDiscoveryStore(createSupabaseAdminClient()),
    });
    logger.info("opportunity_discovery_stage_completed", {
      stage,
      provider: config.provider,
      providerStatus: config.status,
      result,
    });
    return NextResponse.json(
      { status: "completed", stage, providerStatus: config.status, result, correlationId },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof DiscoveryUnavailableError) {
      logger.warn("opportunity_discovery_stage_unavailable", { stage, state: error.state });
      return NextResponse.json(
        { status: error.state, stage, providerStatus: config.status, correlationId },
        { status: 503 },
      );
    }
    logger.error("opportunity_discovery_stage_failed", { stage, error });
    return NextResponse.json(
      { status: "failed", stage, error: "Discovery stage failed safely", correlationId },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
