import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const sensitiveKeyPattern =
  /(password|secret|token|authorization|cookie|api[-_]?key|cv|document|profile|phone|email|address|contact)/i;

export function redactSensitiveText(value: string): string {
  return value
    .replace(/bearer\s+[a-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(sb_(?:secret|publishable)_[a-z0-9_-]+)\b/gi, "[REDACTED_KEY]")
    .replace(/\b(sk_(?:live|test)_[a-z0-9_-]+)\b/gi, "[REDACTED_KEY]")
    .replace(/([?&](?:token|key|secret|password)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/([a-z0-9._%+-]){2,}@[a-z0-9.-]+\.[a-z]{2,}/gi, "[REDACTED_EMAIL]")
    .slice(0, 2_000);
}

function redact(value: unknown, key?: string): unknown {
  if (key && sensitiveKeyPattern.test(key)) return "[REDACTED]";
  if (value instanceof Error) return { name: value.name, message: redactSensitiveText(value.message) };
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.entries(value).reduce<Record<string, unknown>>((result, [entryKey, entryValue]) => {
      result[entryKey] = redact(entryValue, entryKey);
      return result;
    }, {});
  }
  return typeof value === "string" ? redactSensitiveText(value) : value;
}

export function serializeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: redactSensitiveText(error.message) };
  return { name: "UnknownError", message: "An unknown error occurred" };
}

export function createLogger(context: { correlationId?: string } = {}) {
  const minimum: LogLevel =
    process.env.LOG_LEVEL === "debug" ? "debug" : process.env.NODE_ENV === "production" ? "info" : "debug";
  const levels: LogLevel[] = ["debug", "info", "warn", "error"];
  const shouldLog = (level: LogLevel): boolean => levels.indexOf(level) >= levels.indexOf(minimum);
  return {
    log(level: LogLevel, message: string, fields: LogFields = {}): void {
      if (!shouldLog(level)) return;
      const payload = redact({ level, message, correlationId: context.correlationId, ...fields });
      const line = JSON.stringify(payload);
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
    },
    debug(message: string, fields?: LogFields): void {
      this.log("debug", message, fields);
    },
    info(message: string, fields?: LogFields): void {
      this.log("info", message, fields);
    },
    warn(message: string, fields?: LogFields): void {
      this.log("warn", message, fields);
    },
    error(message: string, fields?: LogFields): void {
      this.log("error", message, fields);
    },
  };
}
