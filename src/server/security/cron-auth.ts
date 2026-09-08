import "server-only";

import { timingSafeEqual } from "node:crypto";

export function isCronRequestAuthorized(request: Request, configuredSecret: string | undefined): boolean {
  if (!configuredSecret) return false;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${configuredSecret}`;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}
