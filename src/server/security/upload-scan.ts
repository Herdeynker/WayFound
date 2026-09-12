import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { parseServerEnvironment } from "@/lib/env/schema";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export type UploadPurpose = "passport_document" | "application_document" | "ielts_recording";

type ScanResult =
  | { status: "clean"; provider: string }
  | { status: "infected" | "error"; provider: string; category: string };

const scannerResponseSchema = z.object({ clean: z.boolean() }).strict();
const eicarMarker = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export async function scanUpload(bytes: Uint8Array): Promise<ScanResult> {
  if (new TextDecoder().decode(bytes).includes(eicarMarker))
    return { status: "infected", provider: "local_guard", category: "malware_detected" };
  if (process.env.NODE_ENV === "test" || process.env.PLAYWRIGHT_TEST === "1")
    return { status: "clean", provider: "test_fixture" };

  const env = parseServerEnvironment();
  if (
    env.UPLOAD_SCANNER_PROVIDER !== "clamav_http" ||
    !env.UPLOAD_SCANNER_URL ||
    !env.UPLOAD_SCANNER_TOKEN ||
    !env.UPLOAD_SCANNER_ALLOWED_HOST
  )
    return { status: "error", provider: "disabled", category: "provider_unavailable" };

  const target = new URL(env.UPLOAD_SCANNER_URL);
  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.port ||
    target.hostname !== env.UPLOAD_SCANNER_ALLOWED_HOST.toLowerCase()
  )
    return { status: "error", provider: "clamav_http", category: "provider_unavailable" };

  try {
    const response = await fetch(target, {
      method: "POST",
      body: Buffer.from(bytes),
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
      headers: {
        Authorization: `Bearer ${env.UPLOAD_SCANNER_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
    });
    if (!response.ok) return { status: "error", provider: "clamav_http", category: "provider_unavailable" };
    const parsed = scannerResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return { status: "error", provider: "clamav_http", category: "invalid_response" };
    return parsed.data.clean
      ? { status: "clean", provider: "clamav_http" }
      : { status: "infected", provider: "clamav_http", category: "malware_detected" };
  } catch (error) {
    return {
      status: "error",
      provider: "clamav_http",
      category: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "provider_unavailable",
    };
  }
}

export async function quarantineScanAndPromote(input: {
  userId: string;
  purpose: UploadPurpose;
  idempotencyKey: string;
  bytes: Uint8Array;
  originalFilename: string;
  contentType: string;
  destinationPath: string;
  destinationBucket?: string;
}): Promise<{ ok: true; path: string; scanId: string } | { ok: false; reason: "infected" | "unavailable" }> {
  const admin = createSupabaseAdminClient();
  const scanId = randomUUID();
  const extension = input.originalFilename.includes(".")
    ? `.${input.originalFilename
        .split(".")
        .pop()!
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")}`
    : "";
  const quarantinePath = `${input.userId}/${scanId}/upload${extension}`;
  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  const database = admin as unknown as {
    from(name: string): {
      insert(value: Record<string, unknown>): Promise<{ error: { code?: string } | null }>;
      update(value: Record<string, unknown>): { eq(key: string, value: string): Promise<{ error: unknown }> };
    };
  };
  const inserted = await database.from("document_scan_records").insert({
    id: scanId,
    user_id: input.userId,
    idempotency_key: input.idempotencyKey,
    purpose: input.purpose,
    quarantine_path: quarantinePath,
    original_filename: input.originalFilename.slice(0, 240),
    content_type: input.contentType,
    size_bytes: input.bytes.byteLength,
    checksum_sha256: checksum,
    provider:
      process.env.UPLOAD_SCANNER_PROVIDER ?? (process.env.NODE_ENV === "test" ? "test_fixture" : "disabled"),
  });
  if (inserted.error) return { ok: false, reason: "unavailable" };
  await database
    .from("document_scan_events")
    .insert({ user_id: input.userId, scan_id: scanId, status: "pending" });
  const quarantined = await admin.storage
    .from("user-document-quarantine")
    .upload(quarantinePath, input.bytes, { contentType: input.contentType, upsert: false });
  if (quarantined.error) {
    await database
      .from("document_scan_records")
      .update({
        status: "error",
        failure_category: "provider_unavailable",
        scanned_at: new Date().toISOString(),
      })
      .eq("id", scanId);
    await database.from("document_scan_events").insert({
      user_id: input.userId,
      scan_id: scanId,
      status: "error",
      category: "provider_unavailable",
    });
    return { ok: false, reason: "unavailable" };
  }
  await database
    .from("document_scan_records")
    .update({ status: "scanning", updated_at: new Date().toISOString() })
    .eq("id", scanId);
  await database
    .from("document_scan_events")
    .insert({ user_id: input.userId, scan_id: scanId, status: "scanning" });

  const result = await scanUpload(input.bytes);
  if (result.status !== "clean") {
    await database
      .from("document_scan_records")
      .update({
        status: result.status,
        provider: result.provider,
        failure_category: result.category,
        scanned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanId);
    await database.from("document_scan_events").insert({
      user_id: input.userId,
      scan_id: scanId,
      status: result.status,
      category: result.category,
    });
    await admin.storage.from("user-document-quarantine").remove([quarantinePath]);
    return { ok: false, reason: result.status === "infected" ? "infected" : "unavailable" };
  }

  const promoted = await admin.storage
    .from(input.destinationBucket ?? "user-documents")
    .upload(input.destinationPath, input.bytes, { contentType: input.contentType, upsert: false });
  if (promoted.error) {
    await database
      .from("document_scan_records")
      .update({
        status: "error",
        provider: result.provider,
        failure_category: "promotion_failed",
        scanned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", scanId);
    await database.from("document_scan_events").insert({
      user_id: input.userId,
      scan_id: scanId,
      status: "error",
      category: "promotion_failed",
    });
    await admin.storage.from("user-document-quarantine").remove([quarantinePath]);
    return { ok: false, reason: "unavailable" };
  }
  await database
    .from("document_scan_records")
    .update({
      status: "clean",
      provider: result.provider,
      final_path: input.destinationPath,
      scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", scanId);
  await database
    .from("document_scan_events")
    .insert({ user_id: input.userId, scan_id: scanId, status: "clean" });
  await admin.storage.from("user-document-quarantine").remove([quarantinePath]);
  return { ok: true, path: input.destinationPath, scanId };
}
