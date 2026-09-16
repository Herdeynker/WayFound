import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { validateDocumentUpload } from "@/server/applications/model";
import { getCurrentUser, hasCurrentConsent } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getRequestIdentifier } from "@/server/security/request";
import { quarantineScanAndPromote } from "@/server/security/upload-scan";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!(await hasCurrentConsent(client, user.id, "document_storage")))
    return NextResponse.json({ error: "Document storage consent is required." }, { status: 403 });
  if (
    !(await consumeRateLimit("passport.upload", `${user.id}:${getRequestIdentifier(request)}`, 10, 60_000))
      .allowed
  )
    return NextResponse.json({ error: "Too many uploads. Wait a minute and retry." }, { status: 429 });
  const form = await request.formData();
  const file = form.get("file");
  const documentType = String(form.get("documentType") ?? "cv_resume");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Choose a document to upload." }, { status: 400 });
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
  const path = `${user.id}/${randomUUID()}${validated.extension}`;
  const upload = await quarantineScanAndPromote({
    userId: user.id,
    purpose: "passport_document",
    idempotencyKey: randomUUID(),
    bytes,
    originalFilename: file.name,
    contentType: file.type,
    destinationPath: path,
  });
  if (!upload.ok)
    return NextResponse.json(
      {
        error:
          upload.reason === "infected"
            ? "The upload did not pass the safety scan."
            : "Document scanning is unavailable. Nothing was stored.",
      },
      { status: upload.reason === "infected" ? 422 : 503 },
    );
  const result = await client
    .from("document_metadata")
    .upsert(
      {
        user_id: user.id,
        document_type: documentType,
        readiness_status: "available",
        storage_path: path,
        original_filename: file.name.slice(0, 240),
        mime_type: file.type,
        size_bytes: file.size,
      },
      { onConflict: "user_id,document_type" },
    )
    .select("id, document_type, readiness_status, original_filename, size_bytes")
    .single();
  if (result.error) {
    await client.storage.from("user-documents").remove([path]);
    return NextResponse.json(
      { error: "The upload metadata could not be saved. Please retry." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, document: result.data });
}
