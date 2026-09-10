import { NextResponse, type NextRequest } from "next/server";
import { applicationReminderSchema } from "@/server/applications/model";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

type DynamicClient = {
  from(table: string): { insert(values: Record<string, unknown>): Promise<{ error: unknown }> };
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  const { id } = await params;
  const parsed = applicationReminderSchema.safeParse(await request.json().catch(() => null));
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(id) || new Date(parsed.data.reminderAt) <= new Date())
    return NextResponse.json({ error: "Choose a future reminder for a valid workspace." }, { status: 400 });
  const result = await (client as unknown as DynamicClient).from("application_reminders").insert({
    application_id: id,
    user_id: user.id,
    reminder_at: parsed.data.reminderAt,
    message: parsed.data.message,
  });
  if (result.error)
    return NextResponse.json(
      { error: "The reminder could not be saved to this workspace." },
      { status: 403 },
    );
  return NextResponse.json({ ok: true }, { headers: response.headers });
}
