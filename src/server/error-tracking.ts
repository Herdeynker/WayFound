import "server-only";

export interface ErrorTrackingResult {
  delivered: boolean;
  reason: "disabled" | "queued";
}

export interface ErrorTracker {
  capture(error: unknown, context: { correlationId?: string }): Promise<ErrorTrackingResult>;
}

export function createDisabledErrorTracker(): ErrorTracker {
  return {
    async capture(): Promise<ErrorTrackingResult> {
      return { delivered: false, reason: "disabled" };
    },
  };
}
