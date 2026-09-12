import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { speakingUploadMetadataSchema } from "@/features/ielts/model";
import { getCurrentUser, hasCurrentConsent } from "@/server/auth/service";
import { validateSpeakingAudio } from "@/server/ielts/model";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getRequestIdentifier } from "@/server/security/request";
import { quarantineScanAndPromote } from "@/server/security/upload-scan";

export async function POST(request: NextRequest) {
  const cookieResponse = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, cookieResponse);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!(await hasCurrentConsent(client, user.id, "document_storage")))
    return NextResponse.json(
      { error: "Document storage consent is required for a private recording." },
      { status: 403 },
    );
  if (
    !(await consumeRateLimit("ielts.upload", `${user.id}:${getRequestIdentifier(request)}`, 6, 60_000))
      .allowed
  )
    return NextResponse.json(
      { error: "Too many recording uploads. Wait a minute and retry." },
      { status: 429 },
    );
  const form = await request.formData();
  const file = form.get("file");
  const parsed = speakingUploadMetadataSchema.safeParse({
    contentId: form.get("contentId"),
    idempotencyKey: form.get("idempotencyKey"),
    transcript: form.get("transcript"),
    retentionDays: form.get("retentionDays"),
  });
  if (!parsed.success || !(file instanceof File))
    return NextResponse.json({ error: "Choose a valid audio file and add its transcript." }, { status: 400 });
  const profile = await client
    .from("ielts_profiles")
    .select("recording_retention_days")
    .eq("user_id", user.id)
    .single();
  if (profile.error || profile.data.recording_retention_days !== parsed.data.retentionDays)
    return NextResponse.json(
      { error: "Refresh your IELTS setup before uploading this recording." },
      { status: 409 },
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  let validated;
  try {
    validated = validateSpeakingAudio(file, bytes);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "This audio file is not supported." },
      { status: 400 },
    );
  }
  const attempt = await client.rpc("phase13_start_attempt", {
    candidate_content_id: parsed.data.contentId,
    candidate_attempt_kind: "practice",
    candidate_idempotency_key: parsed.data.idempotencyKey,
  });
  if (attempt.error || !attempt.data)
    return NextResponse.json(
      { error: "This approved speaking task is unavailable for your setup." },
      { status: 409 },
    );
  const admin = createSupabaseAdminClient();
  const existing = await admin
    .from("ielts_speaking_recordings")
    .select("id")
    .eq("attempt_id", attempt.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing.data)
    return NextResponse.json(
      { ok: true, attemptId: attempt.data, recordingId: existing.data.id, reused: true },
      { headers: cookieResponse.headers },
    );
  const parent = await admin
    .from("document_metadata")
    .upsert(
      {
        user_id: user.id,
        document_type: "ielts_speaking_recording",
        category: "language",
        readiness_status: "pending",
        original_filename: file.name.slice(0, 240),
        mime_type: validated.mime,
        size_bytes: file.size,
      },
      { onConflict: "user_id,document_type" },
    )
    .select("id")
    .single();
  if (parent.error)
    return NextResponse.json(
      { error: "The private recording library could not be prepared." },
      { status: 500 },
    );
  const latest = await admin
    .from("document_versions")
    .select("version_number")
    .eq("document_id", parent.data.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionNumber = (latest.data?.version_number ?? 0) + 1;
  const path = `${user.id}/${parent.data.id}/${randomUUID()}${validated.extension}`;
  const upload = await quarantineScanAndPromote({
    userId: user.id,
    purpose: "ielts_recording",
    idempotencyKey: parsed.data.idempotencyKey,
    bytes,
    originalFilename: file.name,
    contentType: validated.mime,
    destinationPath: path,
  });
  if (!upload.ok)
    return NextResponse.json(
      {
        error:
          upload.reason === "infected"
            ? "The recording did not pass the safety scan."
            : "Recording scanning is unavailable. Nothing was stored.",
      },
      { status: upload.reason === "infected" ? 422 : 503 },
    );
  const version = await admin
    .from("document_versions")
    .insert({
      document_id: parent.data.id,
      user_id: user.id,
      storage_path: path,
      original_filename: file.name.slice(0, 240),
      mime_type: validated.mime,
      size_bytes: file.size,
      checksum_sha256: validated.checksum,
      version_number: versionNumber,
      idempotency_key: parsed.data.idempotencyKey,
    })
    .select("id")
    .single();
  if (version.error) {
    await admin.storage.from("user-documents").remove([path]);
    return NextResponse.json(
      { error: "The recording version could not be saved. Choose the file again to retry." },
      { status: 500 },
    );
  }
  const retentionExpiresAt = new Date(Date.now() + parsed.data.retentionDays * 86_400_000).toISOString();
  const recording = await admin
    .from("ielts_speaking_recordings")
    .insert({
      attempt_id: attempt.data,
      user_id: user.id,
      document_id: parent.data.id,
      document_version_id: version.data.id,
      transcript: parsed.data.transcript,
      retention_expires_at: retentionExpiresAt,
    })
    .select("id")
    .single();
  if (recording.error) {
    await admin.from("document_versions").delete().eq("id", version.data.id).eq("user_id", user.id);
    await admin.storage.from("user-documents").remove([path]);
    return NextResponse.json(
      { error: "The private recording could not be saved. Choose the file again to retry." },
      { status: 502 },
    );
  }
  const current = await admin
    .from("document_metadata")
    .update({
      current_version_id: version.data.id,
      storage_path: path,
      readiness_status: "available",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parent.data.id);
  if (current.error) {
    await admin.from("ielts_speaking_recordings").delete().eq("id", recording.data.id).eq("user_id", user.id);
    await admin.from("document_versions").delete().eq("id", version.data.id).eq("user_id", user.id);
    await admin.storage.from("user-documents").remove([path]);
    return NextResponse.json(
      { error: "The recording library could not be updated. Choose the file again to retry." },
      { status: 502 },
    );
  }
  return NextResponse.json(
    { ok: true, attemptId: attempt.data, recordingId: recording.data.id, retentionExpiresAt },
    { headers: cookieResponse.headers },
  );
}
