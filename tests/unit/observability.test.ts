import { describe, expect, it, vi } from "vitest";
import { createDisabledErrorTracker } from "@/server/error-tracking";
import { createLogger } from "@/server/logging";

describe("observability boundaries", () => {
  it("reports disabled error tracking honestly", async () => {
    await expect(
      createDisabledErrorTracker().capture(new Error("failure"), { correlationId: "corr-1234" }),
    ).resolves.toEqual({ delivered: false, reason: "disabled" });
  });

  it("redacts sensitive nested fields from structured logs", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    createLogger({ correlationId: "corr-1234" }).info("test", { profile: { name: "Amara" }, safe: "kept" });
    expect(output.mock.calls[0]?.[0]).toContain("[REDACTED]");
    expect(output.mock.calls[0]?.[0]).not.toContain("Amara");
    expect(output.mock.calls[0]?.[0]).toContain("kept");
    output.mockRestore();
  });
});
