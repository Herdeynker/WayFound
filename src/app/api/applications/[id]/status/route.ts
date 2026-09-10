import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/service";
import { statusTransitionSchema } from "@/server/applications/model";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const { id } = await params;
  const parsed = statusTransitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Choose a valid application status." }, { status: 400 });
  const rpc = client as unknown as {
    rpc(
      name: string,
      args: Record<string, string>,
    ): Promise<{ data: string | null; error: { code?: string } | null }>;
  };
  const result = await rpc.rpc("phase9_transition_application_status", {
    candidate_application_id: id,
    target_status: parsed.data.status,
    optional_note: parsed.data.note,
    request_key: parsed.data.idempotencyKey,
  });
  if (result.error || !result.data)
    return NextResponse.json(
      { error: "That status change is not available for this application." },
      { status: 403 },
    );
  return NextResponse.json({ ok: true, status: result.data }, { headers: response.headers });
}
