import { NextResponse, type NextRequest } from "next/server";
import { checklistUpdateSchema } from "@/server/applications/model";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

type UpdateQuery = {
  eq(column: string, value: string): UpdateQuery;
  select(columns: string): { maybeSingle(): Promise<{ data: unknown; error: unknown }> };
};
type DynamicClient = { from(table: string): { update(values: Record<string, unknown>): UpdateQuery } };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  const { id, itemId } = await params;
  const parsed = checklistUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(itemId))
    return NextResponse.json({ error: "Choose a valid checklist item." }, { status: 400 });
  const result = await (client as unknown as DynamicClient)
    .from("application_checklist_items")
    .update({ completed_at: parsed.data.completed ? new Date().toISOString() : null })
    .eq("id", itemId)
    .eq("application_id", id)
    .select("id")
    .maybeSingle();
  if (result.error || !result.data)
    return NextResponse.json(
      { error: "That checklist item is not available in this workspace." },
      { status: 403 },
    );
  return NextResponse.json({ ok: true }, { headers: response.headers });
}
