import "server-only";

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
