import "server-only";

import type { Database } from "@/server/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

type AdminClient = SupabaseClient<Database, "public">;

export type ExportWorker = (userId: string) => Promise<{ artifactKey: string }>;
export type DeletionWorker = (userId: string) => Promise<{ anonymized: boolean }>;

/** Claims one queue item. A worker can safely retry after a process restart. */
export async function claimDataExportRequest(client: AdminClient) {
  const { data } = await client
    .from("data_export_requests")
    .select("id, user_id")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const { data: claimed } = await client
    .from("data_export_requests")
    .update({ status: "processing" })
    .eq("id", data.id)
    .eq("status", "pending")
    .select("id, user_id")
    .maybeSingle();
  return claimed ?? null;
}

export async function processDataExportRequest(
  worker: ExportWorker,
): Promise<"completed" | "failed" | "empty"> {
  const client = createSupabaseAdminClient();
  const request = await claimDataExportRequest(client);
  if (!request) return "empty";
  try {
    await worker(request.user_id);
    await client
      .from("data_export_requests")
      .update({ status: "completed", completed_at: new Date().toISOString(), failure_code: null })
      .eq("id", request.id);
    return "completed";
  } catch {
    await client
      .from("data_export_requests")
      .update({ status: "failed", failure_code: "worker_failed" })
      .eq("id", request.id);
    return "failed";
  }
}

/** The destructive/anonymizing worker is intentionally injected after legal retention policy approval. */
export async function processDueAccountDeletion(worker: DeletionWorker): Promise<"completed" | "empty"> {
  const client = createSupabaseAdminClient();
  const { data } = await client
    .from("account_deletion_requests")
    .select("id, user_id")
    .eq("status", "pending")
    .lte("grace_period_ends_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (!data) return "empty";
  await client
    .from("account_deletion_requests")
    .update({ status: "processing" })
    .eq("id", data.id)
    .eq("status", "pending");
  await worker(data.user_id);
  await client
    .from("account_deletion_requests")
    .update({ status: "completed" })
    .eq("id", data.id)
    .eq("status", "processing");
  return "completed";
}
