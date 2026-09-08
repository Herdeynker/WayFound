import { describe, expect, it } from "vitest";
import { InMemoryFixedWindowRateLimiter } from "@/server/security/rate-limit";
import { getSafeRedirectPath } from "@/server/security/redirect";

describe("security primitives", () => {
  it("allows local paths but rejects open redirects", () => {
    expect(getSafeRedirectPath("/account/settings")).toBe("/account/settings");
    expect(getSafeRedirectPath("//evil.example")).toBe("/");
    expect(getSafeRedirectPath("https://evil.example")).toBe("/");
    expect(getSafeRedirectPath("/\\evil.example")).toBe("/");
  });

  it("enforces a local fixed-window limit", () => {
    const limiter = new InMemoryFixedWindowRateLimiter();
    expect(limiter.check("test-client", 2, 60_000).allowed).toBe(true);
    expect(limiter.check("test-client", 2, 60_000).allowed).toBe(true);
    expect(limiter.check("test-client", 2, 60_000).allowed).toBe(false);
  });
});
