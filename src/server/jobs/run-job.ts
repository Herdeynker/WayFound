import "server-only";

import { randomUUID } from "node:crypto";
import type { JobExecutionStore, JobName, JobResult, JobRunMetadata } from "./types";

export class InMemoryJobExecutionStore implements JobExecutionStore {
  private readonly completed = new Set<string>();

  async hasCompleted(idempotencyKey: string): Promise<boolean> {
    return this.completed.has(idempotencyKey);
  }
  async markStarted(): Promise<void> {}
  async markCompleted(result: JobResult<unknown>): Promise<void> {
    if (result.status === "succeeded") this.completed.add(result.metadata.idempotencyKey);
  }
}

export async function runIdempotentJob<T>(input: {
  jobName: JobName;
  correlationId: string;
  idempotencyKey: string;
  store: JobExecutionStore;
  execute: (metadata: JobRunMetadata) => Promise<T>;
}): Promise<JobResult<T>> {
  const metadata: JobRunMetadata = {
    jobName: input.jobName,
    runId: randomUUID(),
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    startedAt: new Date().toISOString(),
  };
  if (await input.store.hasCompleted(input.idempotencyKey)) {
    return { status: "skipped", metadata, completedAt: new Date().toISOString() };
  }
  await input.store.markStarted(metadata);
  try {
    const value = await input.execute(metadata);
    const result: JobResult<T> = {
      status: "succeeded",
      metadata,
      completedAt: new Date().toISOString(),
      value,
    };
    await input.store.markCompleted(result as JobResult<unknown>);
    return result;
  } catch (error: unknown) {
    const result: JobResult<T> = {
      status: "failed",
      metadata,
      completedAt: new Date().toISOString(),
      error: {
        code: "JOB_EXECUTION_FAILED",
        message: error instanceof Error ? error.message : "Job failed",
        retryable: true,
      },
    };
    await input.store.markCompleted(result as JobResult<unknown>);
    return result;
  }
}
