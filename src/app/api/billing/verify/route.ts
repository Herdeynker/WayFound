import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyCheckoutReference } from "@/server/billing/service";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";

const referenceSchema = z.string().regex(/^[A-Za-z0-9.=\-]{16,100}$/);

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, response);
  const user = await getCurrentUser(client);
  if (!user?.email) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { reference?: unknown } | null;
  const reference = referenceSchema.safeParse(body?.reference);
  if (!reference.success)
    return NextResponse.json({ error: "The payment reference is invalid." }, { status: 400 });
  try {
    const verified = await verifyCheckoutReference({
      userId: user.id,
      email: user.email,
      reference: reference.data,
    });
    return NextResponse.json({ ok: true, ...verified }, { headers: response.headers });
  } catch {
    return NextResponse.json(
      { error: "Payment is not verified yet. Your access has not changed." },
      { status: 409 },
    );
  }
}
