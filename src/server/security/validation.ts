import "server-only";

import type { ZodType } from "zod";

export function parseInput<T>(input: unknown, schema: ZodType<T>): T {
  return schema.parse(input);
}
