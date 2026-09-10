import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/service";
import { createWorkspaceSchema } from "@/server/applications/model";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const parsed = createWorkspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Choose a valid match before creating a workspace." }, { status: 400 });
  const rpc = client as unknown as {
    rpc(
      name: string,
      args: Record<string, string>,
    ): Promise<{ data: string | null; error: { code?: string } | null }>;
  };
  const result = await rpc.rpc("phase9_create_application_workspace", {
    candidate_match_id: parsed.data.matchId,
    request_key: parsed.data.idempotencyKey,
  });
  if (result.error || !result.data)
    return NextResponse.json(
      { error: "That workspace could not be created from this match." },
      { status: 403 },
    );
  return NextResponse.json({ ok: true, applicationId: result.data }, { headers: response.headers });
}
