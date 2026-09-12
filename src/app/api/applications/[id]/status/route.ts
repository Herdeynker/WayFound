import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/service";
import { statusTransitionSchema } from "@/server/applications/model";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { recordProductEvent } from "@/server/analytics";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!(await consumeRateLimit("applications.status", user.id, 30, 60_000)).allowed)
    return NextResponse.json({ error: "Too many status updates. Wait a minute and retry." }, { status: 429 });
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
  if (["submitted", "successful", "unsuccessful", "withdrawn"].includes(parsed.data.status))
    await recordProductEvent({
      userId: user.id,
      eventType: parsed.data.status === "submitted" ? "application_submitted" : "outcome_recorded",
      idempotencyKey: parsed.data.idempotencyKey,
      properties: { status: parsed.data.status },
    });
  return NextResponse.json({ ok: true, status: result.data }, { headers: response.headers });
}
