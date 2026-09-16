import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseRouteClient } from "@/server/supabase/route";

const schema = z.object({ action: z.enum(["collapse", "expand", "dismiss", "reopen"]) }).strict();
type DynamicQuery = {
  upsert(values: Record<string, unknown>, options: { onConflict: string }): Promise<{ error: unknown }>;
};
type DynamicClient = { from(name: string): DynamicQuery };

export async function PATCH(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checklist state." }, { status: 400 });
  const action = parsed.data.action;
  const result = await (client as unknown as DynamicClient).from("user_checklist_state").upsert(
    {
      user_id: user.id,
      collapsed_at: action === "collapse" ? new Date().toISOString() : null,
      dismissed_at: action === "dismiss" ? new Date().toISOString() : null,
    },
    { onConflict: "user_id" },
  );
  if (result.error)
    return NextResponse.json({ error: "We could not save checklist state." }, { status: 500 });
  return response;
}
