import { describe, expect, it } from "vitest";
import { parseServerEnvironment } from "@/lib/env/schema";

describe("server environment validation", () => {
  it("fails clearly when required production variables are missing", () => {
    expect(() => parseServerEnvironment({ NODE_ENV: "production" })).toThrow(
      "Missing required production environment variables: APP_URL, SUPABASE_URL, SUPABASE_SECRET_KEY",
    );
  });

  it("accepts the minimum production configuration", () => {
    const result = parseServerEnvironment({
      NODE_ENV: "production",
      APP_URL: "https://wayfound.example",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "server-only-test-value",
    });
    expect(result.APP_URL).toBe("https://wayfound.example");
  });
});
