import { NextResponse } from "next/server";
import { parseServerEnvironment } from "@/lib/env/schema";
import { parseWebhook, storeWebhookEvent } from "@/server/billing/service";
import { verifyPaystackSignature } from "@/server/billing/model";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = parseServerEnvironment().PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Payment provider unavailable." }, { status: 503 });
  const rawBody = await request.text();
  if (!verifyPaystackSignature(rawBody, request.headers.get("x-paystack-signature"), secret))
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  try {
    const result = await storeWebhookEvent(parseWebhook(rawBody), rawBody);
    return NextResponse.json({ received: true, duplicate: result.duplicate });
  } catch {
    return NextResponse.json({ error: "Event could not be accepted." }, { status: 400 });
  }
}
