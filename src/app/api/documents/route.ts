import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, hasCurrentConsent } from "@/server/auth/service";
import { documentUploadSchema, validateDocumentUpload } from "@/server/applications/model";
import { createSupabaseRouteClient } from "@/server/supabase/route";

type QueryResult = { data: unknown; error: { code?: string } | null };
type Phase9Query = {
  select(columns: string): Phase9Query;
  eq(column: string, value: string): Phase9Query;
  order(column: string, options?: { ascending?: boolean }): Phase9Query;
  limit(count: number): Phase9Query;
  maybeSingle(): Promise<QueryResult>;
  single(): Promise<QueryResult>;
  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): Phase9Query;
  insert(values: Record<string, unknown>): Phase9Query;
  update(values: Record<string, unknown>): Phase9Query;
};
type Phase9Client = { from(table: string): Phase9Query };

function idFrom(value: unknown): string | null {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string"
    ? (value as { id: string }).id
    : null;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!(await hasCurrentConsent(client, user.id, "document_storage")))
    return NextResponse.json({ error: "Document storage consent is required." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const metadata = documentUploadSchema.safeParse({
    documentType: form.get("documentType"),
    category: form.get("category") ?? "other",
    expiresOn: form.get("expiresOn") || undefined,
  });
  const idempotencyKey =
    typeof form.get("idempotencyKey") === "string" ? String(form.get("idempotencyKey")) : "";
  if (!metadata.success || !/^[0-9a-f-]{36}$/i.test(idempotencyKey) || !(file instanceof File))
    return NextResponse.json({ error: "Choose a valid document and upload request." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  let validated;
  try {
    validated = validateDocumentUpload(file, bytes);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "This file is not supported." },
      { status: 400 },
    );
  }
  const phase9 = client as unknown as Phase9Client;
  const parent = await phase9
    .from("document_metadata")
    .upsert(
      {
        user_id: user.id,
        document_type: metadata.data.documentType,
        category: metadata.data.category,
        expires_on: metadata.data.expiresOn ?? null,
        readiness_status: "available",
        original_filename: file.name.slice(0, 240),
        mime_type: file.type,
        size_bytes: file.size,
      },
      { onConflict: "user_id,document_type" },
    )
    .select("id")
    .single();
  const documentId = idFrom(parent.data);
  if (parent.error || !documentId)
    return NextResponse.json({ error: "The document library could not be updated." }, { status: 500 });
  const prior = await phase9
    .from("document_versions")
    .select("id,storage_path")
    .eq("document_id", documentId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (!prior.error && prior.data)
    return NextResponse.json({ ok: true, documentId, reused: true }, { headers: response.headers });
  const version = await phase9
    .from("document_versions")
    .select("version_number")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const priorVersion =
    typeof version.data === "object" &&
    version.data !== null &&
    typeof (version.data as { version_number?: unknown }).version_number === "number"
      ? (version.data as { version_number: number }).version_number
      : 0;
  const path = `${user.id}/${documentId}/${randomUUID()}${validated.extension}`;
  const upload = await client.storage
    .from("user-documents")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upload.error)
    return NextResponse.json({ error: "The upload was interrupted. Please retry." }, { status: 502 });
  const created = await phase9
    .from("document_versions")
    .insert({
      document_id: documentId,
      user_id: user.id,
      storage_path: path,
      original_filename: file.name.slice(0, 240),
      mime_type: file.type,
      size_bytes: file.size,
      checksum_sha256: validated.checksum,
      version_number: priorVersion + 1,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();
  const versionId = idFrom(created.data);
  if (created.error || !versionId) {
    await client.storage.from("user-documents").remove([path]);
    return NextResponse.json(
      { error: "The document version could not be saved. Please retry." },
      { status: 500 },
    );
  }
  const current = await phase9
    .from("document_metadata")
    .update({ current_version_id: versionId, storage_path: path, updated_at: new Date().toISOString() })
    .eq("id", documentId)
    .select("id")
    .single();
  if (current.error)
    return NextResponse.json(
      { error: "The document was saved but needs recovery. Please refresh." },
      { status: 502 },
    );
  return NextResponse.json({ ok: true, documentId, versionId }, { headers: response.headers });
}
