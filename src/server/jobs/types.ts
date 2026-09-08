import "server-only";

export type JobName = "phase0.foundation-check";

export interface JobError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface JobRunMetadata {
  jobName: JobName;
  runId: string;
  correlationId: string;
  idempotencyKey: string;
  startedAt: string;
}

export interface JobResult<T> {
  status: "succeeded" | "failed" | "skipped";
  metadata: JobRunMetadata;
  completedAt: string;
  value?: T;
  error?: JobError;
}

export interface JobExecutionStore {
  hasCompleted(idempotencyKey: string): Promise<boolean>;
  markStarted(metadata: JobRunMetadata): Promise<void>;
  markCompleted(result: JobResult<unknown>): Promise<void>;
}
