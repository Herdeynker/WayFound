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
      timestamp: new Date().toISOString(),
    },
    { status: configurationReady ? 200 : 503 },
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Content-Type", "application/json; charset=utf-8");
  response.headers.set("x-correlation-id", correlationId);
  return response;
}
