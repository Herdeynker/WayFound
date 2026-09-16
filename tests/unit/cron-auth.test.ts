import { describe, expect, it } from "vitest";
import vercel from "../../vercel.json";
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

describe("production scheduler", () => {
  it("runs bounded discovery stages without exceeding the 25-call daily Brave limit", () => {
    expect(vercel.crons).toEqual([
      { path: "/api/internal/discovery/query_generation", schedule: "7 0 * * *" },
      { path: "/api/internal/discovery/web_discovery", schedule: "17 * * * *" },
      { path: "/api/internal/discovery/known_source_monitoring", schedule: "11 */6 * * *" },
      { path: "/api/internal/discovery/lead_resolution", schedule: "*/15 * * * *" },
      { path: "/api/internal/billing", schedule: "7 * * * *" },
      { path: "/api/internal/notifications", schedule: "*/10 * * * *" },
    ]);
    const dailySearchCalls = vercel.crons.filter((cron) => cron.path.endsWith("/web_discovery")).length * 24;
    expect(dailySearchCalls).toBeLessThanOrEqual(25);
  });
});
