import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Choose a valid document." }, { status: 400 });
  const record = await client
    .from("document_metadata")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (record.error || !record.data?.storage_path)
    return NextResponse.json({ error: "That document is not available." }, { status: 404 });
  const signed = await client.storage.from("user-documents").createSignedUrl(record.data.storage_path, 60);
  if (signed.error || !signed.data?.signedUrl)
    return NextResponse.json(
      { error: "Secure document access is temporarily unavailable." },
      { status: 502 },
    );
  return NextResponse.json(
    { ok: true, url: signed.data.signedUrl, expiresInSeconds: 60 },
    { headers: response.headers },
  );
}
