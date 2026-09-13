import "server-only";

import type { QuotaConsumption } from "./types";

type WindowState = { key: string; count: number };

/** Deterministic reference implementation used by worker tests; production uses the atomic database RPC. */
export class ZeroCostQuotaLedger {
  private day: WindowState = { key: "", count: 0 };
  private month: WindowState = { key: "", count: 0 };
  private lock: Promise<void> = Promise.resolve();

  async consume(input: { now: Date; dailyLimit: number; monthlyLimit: number }): Promise<QuotaConsumption> {
    if (
      !Number.isInteger(input.dailyLimit) ||
      !Number.isInteger(input.monthlyLimit) ||
      input.dailyLimit < 1 ||
      input.dailyLimit > 25 ||
      input.monthlyLimit < 1 ||
      input.monthlyLimit > 750
    )
      throw new Error("Quota state is outside the zero-cost safety ceiling.");
    let release: (() => void) | undefined;
    const previous = this.lock;
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const dayKey = input.now.toISOString().slice(0, 10);
      const monthKey = input.now.toISOString().slice(0, 7);
      if (this.day.key !== dayKey) this.day = { key: dayKey, count: 0 };
      if (this.month.key !== monthKey) this.month = { key: monthKey, count: 0 };
      const allowed = this.day.count < input.dailyLimit && this.month.count < input.monthlyLimit;
      if (allowed) {
        this.day.count += 1;
        this.month.count += 1;
      }
      return {
        allowed,
        dailyUsed: this.day.count,
        monthlyUsed: this.month.count,
        dailyRemaining: Math.max(0, input.dailyLimit - this.day.count),
        monthlyRemaining: Math.max(0, input.monthlyLimit - this.month.count),
      };
    } finally {
      release?.();
    }
  }
}

export class DomainCircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  canRequest(now = new Date()): boolean {
    return now.getTime() >= this.openUntil;
  }

  recordSuccess() {
    this.failures = 0;
    this.openUntil = 0;
  }

  recordFailure(now = new Date()) {
    this.failures += 1;
    if (this.failures >= 3)
      this.openUntil = now.getTime() + Math.min(3600_000, 60_000 * 2 ** (this.failures - 3));
  }
}
