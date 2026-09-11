import { NextResponse } from "next/server";
import { parseServerEnvironment } from "@/lib/env/schema";
import { runBillingReconciliation } from "@/server/billing/service";
import { isCronRequestAuthorized } from "@/server/security/cron-auth";
import { getCorrelationId } from "@/server/security/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const env = parseServerEnvironment();
  const correlationId = getCorrelationId(request);
  if (!isCronRequestAuthorized(request, env.CRON_SECRET))
    return NextResponse.json({ error: "Unauthorized", correlationId }, { status: 401 });
  if (env.BILLING_CRON_ENABLED !== "true")
    return NextResponse.json({ status: "disabled", correlationId }, { status: 503 });
  try {
    const result = await runBillingReconciliation({ limit: env.BILLING_BATCH_SIZE ?? 20 });
    return NextResponse.json({ status: "completed", correlationId, ...result });
  } catch {
    return NextResponse.json(
      { error: "Billing reconciliation could not complete.", correlationId },
      { status: 503 },
    );
  }
}
