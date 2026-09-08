import { describe, expect, it } from "vitest";
import { isCronRequestAuthorized } from "@/server/security/cron-auth";

describe("cron authentication", () => {
  it("requires an exact bearer secret and rejects missing configuration", () => {
    const request = new Request("http://localhost/cron", {
      headers: { authorization: "Bearer cron-secret" },
    });
    expect(isCronRequestAuthorized(request, "cron-secret")).toBe(true);
    expect(isCronRequestAuthorized(request, "wrong-secret")).toBe(false);
    expect(isCronRequestAuthorized(request, undefined)).toBe(false);
  });
});
