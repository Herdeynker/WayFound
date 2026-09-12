import { NextResponse } from "next/server";
import { parseServerEnvironment } from "@/lib/env/schema";
import { getOperationsSummary } from "@/server/operations/summary";
import { isCronRequestAuthorized } from "@/server/security/cron-auth";
import { getCorrelationId } from "@/server/security/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const env = parseServerEnvironment();
  if (!isCronRequestAuthorized(request, env.CRON_SECRET))
    return NextResponse.json({ error: "Unauthorized", correlationId }, { status: 401 });
  try {
    return NextResponse.json({ status: "ok", correlationId, ...(await getOperationsSummary()) });
  } catch {
    return NextResponse.json(
      { status: "unavailable", correlationId, error: "Operations summary could not be loaded." },
      { status: 503 },
    );
  }
}
