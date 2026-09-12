import { describe, expect, it, vi } from "vitest";
import { analyticsIdempotencyKey, sanitizeAnalyticsProperties } from "@/server/analytics";
import { assertPublicSourceHost, isPublicNetworkAddress } from "@/server/ingestion/security";
import { redactSensitiveText, serializeError } from "@/server/logging";
import { scanUpload } from "@/server/security/upload-scan";

describe("Phase 14 launch security", () => {
  it("rejects private, reserved and mapped network addresses", async () => {
    expect(isPublicNetworkAddress("8.8.8.8")).toBe(true);
    for (const address of [
      "127.0.0.1",
      "10.0.0.2",
      "100.64.0.1",
      "169.254.1.2",
      "192.168.1.2",
      "::1",
      "fd00::1",
      "::ffff:127.0.0.1",
    ])
      expect(isPublicNetworkAddress(address)).toBe(false);
    await expect(
      assertPublicSourceHost(new URL("https://safe.example"), async () => [{ address: "10.0.0.5" }]),
    ).rejects.toThrow("Unsafe source host resolution");
    await expect(
      assertPublicSourceHost(new URL("https://safe.example"), async () => [{ address: "8.8.8.8" }]),
    ).resolves.toBeUndefined();
  });

  it("keeps funnel events deterministic and strips sensitive properties", () => {
    const first = analyticsIdempotencyKey("registration", "stable-user");
    expect(analyticsIdempotencyKey("registration", "stable-user")).toBe(first);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      sanitizeAnalyticsProperties({ channel: "email", email: "private@example.test", cv: "raw", extra: 1 }),
    ).toEqual({ channel: "email" });
  });

  it("redacts credentials and contact data even inside error text", () => {
    const supabaseSecretCanary = ["sb", "secret", "hidden"].join("_");
    const message = `Bearer top.secret token?token=private person@example.test ${supabaseSecretCanary}`;
    expect(redactSensitiveText(message)).not.toContain(supabaseSecretCanary);
    expect(redactSensitiveText(message)).not.toMatch(/top\.secret|private|person@example/);
    expect(serializeError(new Error(message)).message).toContain("[REDACTED");
  });

  it("quarantines the standard malware test marker and provides an explicit clean test fixture", async () => {
    const marker = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    await expect(scanUpload(new TextEncoder().encode(marker))).resolves.toMatchObject({ status: "infected" });
    vi.stubEnv("NODE_ENV", "test");
    await expect(scanUpload(new TextEncoder().encode("safe synthetic file"))).resolves.toMatchObject({
      status: "clean",
      provider: "test_fixture",
    });
    vi.unstubAllEnvs();
  });
});
