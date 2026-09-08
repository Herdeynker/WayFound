import { NextResponse } from "next/server";
import { parseServerEnvironment } from "@/lib/env/schema";
import { getCorrelationId } from "@/server/security/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  let configurationReady = true;
  if (process.env.NODE_ENV === "production") {
    try {
      parseServerEnvironment();
    } catch {
      configurationReady = false;
    }
  }
  const response = NextResponse.json(
    {
      status: configurationReady ? "ok" : "degraded",
      buildVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.npm_package_version ?? "development",
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
      dependencies: { configuration: configurationReady ? "ready" : "not_ready" },
    },
    { status: configurationReady ? 200 : 503 },
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("x-correlation-id", correlationId);
  return response;
}
