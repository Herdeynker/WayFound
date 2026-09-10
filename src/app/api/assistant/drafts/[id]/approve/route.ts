import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { approveDraft } from "@/server/assistant/service";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

const schema = z.object({ revisionId: z.string().uuid() }).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieResponse = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, cookieResponse);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json({ error: "Choose a valid draft revision." }, { status: 400 });
  try {
    await approveDraft(client, id, parsed.data.revisionId);
    return NextResponse.json({ ok: true }, { headers: cookieResponse.headers });
  } catch {
    return NextResponse.json({ error: "That revision is not available to this account." }, { status: 403 });
  }
}
