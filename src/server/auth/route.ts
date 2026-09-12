import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { createSupabaseRouteClient } from "@/server/supabase/route";

export async function rateLimitAuth(request: NextRequest, action: string): Promise<NextResponse | null> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = await consumeRateLimit(`auth.${action}`, ip, 8, 60_000);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many attempts. Please wait a minute and try again." },
    { status: 429 },
  );
}

export function createAuthResponse(request: NextRequest, body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });
  const client = createSupabaseRouteClient(request, response);
  return { response, client };
}
