import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

type OperationResult = { data: Array<Record<string, unknown>> | null; count: number | null; error: unknown };
type OperationQuery = PromiseLike<OperationResult> & {
  select(columns: string, options?: { count?: "exact"; head?: boolean }): OperationQuery;
  eq(column: string, value: string): OperationQuery;
  is(column: string, value: null): OperationQuery;
  in(column: string, values: string[]): OperationQuery;
  gte(column: string, value: string): OperationQuery;
  order(column: string, options?: { ascending?: boolean }): OperationQuery;
  limit(count: number): OperationQuery;
};

const numberOrZero = (value: number | null) => value ?? 0;
const timestampOrNull = (data: Array<Record<string, unknown>> | null, key: string) => {
  const value = data?.[0]?.[key];
  return typeof value === "string" ? value : null;
};

export async function getOperationsSummary(now = new Date()) {
  const admin = createSupabaseAdminClient() as unknown as { from(name: string): OperationQuery };
  const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const [
    latestIngestion,
    ingestionFailures,
    deliveryFailures,
    deliveryPending,
    billingPending,
    scanBacklog,
    scanInfected,
    aiUsage,
    funnelEvents,
  ] = await Promise.all([
    admin
      .from("ingestion_runs")
      .select("finished_at")
      .eq("state", "succeeded")
      .order("finished_at", { ascending: false })
      .limit(1),
    admin.from("ingestion_failures").select("id", { count: "exact", head: true }).is("resolved_at", null),
    admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "permanent_failure")
      .gte("created_at", since),
    admin
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "scheduled", "sending", "retry"]),
    admin
      .from("billing_provider_events")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "processing", "retry", "failed"]),
    admin
      .from("document_scan_records")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "scanning", "error"]),
    admin
      .from("document_scan_records")
      .select("id", { count: "exact", head: true })
      .eq("status", "infected")
      .gte("created_at", since),
    admin
      .from("assistant_usage_ledger")
      .select("estimated_cost_microunits")
      .gte("created_at", since)
      .limit(5000),
    admin
      .from("product_analytics_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", since),
  ]);
  const results = [
    latestIngestion,
    ingestionFailures,
    deliveryFailures,
    deliveryPending,
    billingPending,
    scanBacklog,
    scanInfected,
    aiUsage,
    funnelEvents,
  ];
  if (results.some((result) => result.error)) throw new Error("Operations summary is unavailable");
  const estimatedAiCostMicrounits = (aiUsage.data ?? []).reduce((total, row) => {
    const value = row.estimated_cost_microunits;
    return total + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
  return {
    generatedAt: now.toISOString(),
    windowHours: 24,
    ingestion: {
      lastSuccessfulAt: timestampOrNull(latestIngestion.data, "finished_at"),
      unresolvedFailures: numberOrZero(ingestionFailures.count),
    },
    notifications: {
      pending: numberOrZero(deliveryPending.count),
      failedLast24Hours: numberOrZero(deliveryFailures.count),
    },
    billing: { unresolvedProviderEvents: numberOrZero(billingPending.count) },
    uploads: {
      scanBacklog: numberOrZero(scanBacklog.count),
      infectedLast24Hours: numberOrZero(scanInfected.count),
    },
    providers: { estimatedAiCostMicrounits },
    funnel: { eventsLast24Hours: numberOrZero(funnelEvents.count) },
  };
}
