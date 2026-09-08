import { describe, expect, it } from "vitest";
import { GET } from "@/app/health/route";

describe("GET /health", () => {
  it("returns readiness without sensitive configuration", async () => {
    const response = await GET(new Request("http://localhost/health"));
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(body).not.toHaveProperty("environmentVariables");
  });
});
