import { describe, expect, it } from "vitest";
import { InMemoryJobExecutionStore, runIdempotentJob } from "@/server/jobs/run-job";

describe("idempotent jobs", () => {
  it("skips a completed idempotency key on replay", async () => {
    const store = new InMemoryJobExecutionStore();
    const execute = async () => "done";
    const first = await runIdempotentJob({
      jobName: "phase0.foundation-check",
      correlationId: "corr-1234",
      idempotencyKey: "key-1",
      store,
      execute,
    });
    const second = await runIdempotentJob({
      jobName: "phase0.foundation-check",
      correlationId: "corr-5678",
      idempotencyKey: "key-1",
      store,
      execute,
    });
    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("skipped");
  });
});
