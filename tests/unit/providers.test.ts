import { describe, expect, it } from "vitest";
import {
  createDisabledAIProvider,
  createDisabledDiscoveryProvider,
  ProviderDisabledError,
} from "@/server/providers";

describe("disabled provider adapters", () => {
  it("returns an explicit controlled error instead of pretending success", async () => {
    await expect(createDisabledDiscoveryProvider().search({ query: "test", limit: 1 })).rejects.toMatchObject(
      {
        code: "PROVIDER_DISABLED",
        provider: "discovery",
      },
    );
    await expect(
      createDisabledAIProvider().generateStructured({
        operation: "test",
        input: {},
        outputSchema: undefined as never,
      }),
    ).rejects.toBeInstanceOf(ProviderDisabledError);
  });
});
