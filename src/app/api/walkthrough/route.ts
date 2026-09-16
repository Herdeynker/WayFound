import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseRouteClient } from "@/server/supabase/route";

const schema = z
  .object({
    version: z.string().regex(/^v[0-9]+$/),
    action: z.enum(["started", "completed", "dismissed", "restarted"]),
  })
  .strict();
type DynamicQuery = {
  select(columns: string): DynamicQuery;
  eq(column: string, value: string): DynamicQuery;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
  upsert(values: Record<string, unknown>, options: { onConflict: string }): Promise<{ error: unknown }>;
};
type DynamicClient = { from(name: string): DynamicQuery };

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ version: "v1", completed: false, dismissed: false });
  const client = createSupabaseRouteClient(request, response);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const result = await (client as unknown as DynamicClient)
    .from("user_walkthrough_state")
    .select("version,completed_at,dismissed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (result.error) return NextResponse.json({ version: "v1", completed: false, dismissed: false });
  return NextResponse.json({
    version: result.data?.version ?? "v1",
    completed: Boolean(result.data?.completed_at),
    dismissed: Boolean(result.data?.dismissed_at),
  });
}

export async function PATCH(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid walkthrough state." }, { status: 400 });
  const now = new Date().toISOString();
  const state = {
    user_id: user.id,
    version: parsed.data.version,
    started_at: now,
    completed_at: ["completed"].includes(parsed.data.action) ? now : null,
    dismissed_at: ["dismissed"].includes(parsed.data.action) ? now : null,
  };
  const result = await (client as unknown as DynamicClient)
    .from("user_walkthrough_state")
    .upsert(state, { onConflict: "user_id" });
  if (result.error)
    return NextResponse.json({ error: "We could not save walkthrough state." }, { status: 500 });
  return response;
}
