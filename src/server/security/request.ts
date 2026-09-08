import "server-only";

import { randomUUID } from "node:crypto";

export function getCorrelationId(request: Request): string {
  const supplied = request.headers.get("x-correlation-id");
  return supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied) ? supplied : randomUUID();
}

export function getRequestIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwarded || realIp;
  return candidate && candidate.length <= 128 ? candidate : "unknown";
}
