import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  check(identifier: string, limit: number, windowMs: number): RateLimitResult;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class InMemoryFixedWindowRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  check(identifier: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const existing = this.buckets.get(identifier);
    const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    this.buckets.set(identifier, bucket);
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }
}

const developmentLimiter = new InMemoryFixedWindowRateLimiter();

/**
 * Uses one atomic, database-backed counter in production so limits cannot be
 * bypassed by changing server instances. Test and local fixture runs use an
 * isolated in-memory counter when server credentials are intentionally absent.
 */
export async function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const subjectHash = createHash("sha256").update(identifier).digest("hex");
  try {
    const admin = createSupabaseAdminClient() as unknown as {
      rpc(
        name: string,
        args: Record<string, unknown>,
      ): Promise<{
        data: Array<{ allowed: boolean; remaining: number; reset_at: string }> | null;
        error: { message?: string } | null;
      }>;
    };
    const result = await admin.rpc("phase14_consume_rate_limit", {
      candidate_scope: scope,
      candidate_subject_hash: subjectHash,
      maximum_requests: limit,
      window_seconds: Math.max(1, Math.ceil(windowMs / 1_000)),
    });
    const row = result.data?.[0];
    if (result.error || !row) throw new Error("Persistent rate limiter is unavailable");
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt: Date.parse(row.reset_at),
    };
  } catch {
    if (process.env.NODE_ENV === "production" && process.env.PLAYWRIGHT_TEST !== "1") {
      return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs };
    }
    return developmentLimiter.check(`${scope}:${subjectHash}`, limit, windowMs);
  }
}
