import "server-only";

import { createHash } from "node:crypto";
import type { ErrorClassification, RetryDecision, SourcePolicy } from "./types";

const privateIpv4 = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
const forbiddenHost = /(^|\.)(localhost|local|internal|metadata\.google\.internal)$/i;

export function assertSafeSourceUrl(value: string, policy: Pick<SourcePolicy, "allowedDomains">): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error("Unsafe source URL.");
  const host = url.hostname.toLowerCase();
  if (forbiddenHost.test(host) || privateIpv4.test(host) || host.includes(":"))
    throw new Error("Unsafe source host.");
  const permitted = policy.allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!permitted) throw new Error("Source URL is outside the registered allowlist.");
  return url;
}

export function safeResponseMetadata(response: Response, byteLength: number) {
  return {
    statusCode: response.status,
    contentType: response.headers.get("content-type")?.split(";")[0] ?? null,
    etag: response.headers.get("etag")?.slice(0, 256) ?? null,
    lastModified: response.headers.get("last-modified")?.slice(0, 256) ?? null,
    byteLength,
  };
}

export async function fetchRegisteredSource(input: {
  policy: SourcePolicy;
  url: string;
  signal?: AbortSignal;
}) {
  let target = assertSafeSourceUrl(input.url, input.policy);
  for (let redirects = 0; redirects <= input.policy.redirectLimit; redirects += 1) {
    const response = await fetch(target, {
      redirect: "manual",
      signal: input.signal ?? AbortSignal.timeout(input.policy.requestTimeoutMs),
      headers: { Accept: "text/html,application/json;q=0.9", "User-Agent": "WAYFOUND-Source-Refresh/1.0" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === input.policy.redirectLimit)
        throw new Error("Unsafe or excessive redirect.");
      target = assertSafeSourceUrl(new URL(location, target).toString(), input.policy);
      continue;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^(text\/html|application\/json)(;|$)/i.test(contentType))
      throw new Error("Unsupported response content type.");
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > input.policy.responseSizeLimitBytes)
      throw new Error("Response exceeds registered size limit.");
    return {
      response,
      finalUrl: target.toString(),
      body,
      metadata: safeResponseMetadata(response, body.byteLength),
    };
  }
  throw new Error("Redirect limit exceeded.");
}

export function classifyFetchFailure(
  error: unknown,
  attempt: number,
  retryLimit: number,
  jitter = 0.5,
): RetryDecision {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const classification: ErrorClassification = message.includes("timeout")
    ? "timeout"
    : message.includes("rate")
      ? "rate_limited"
      : message.includes("unsafe") || message.includes("allowlist")
        ? "policy_blocked"
        : message.includes("content")
          ? "invalid_content"
          : "temporary_http";
  const retryable =
    ["timeout", "rate_limited", "temporary_http"].includes(classification) && attempt <= retryLimit;
  return {
    classification,
    retryable,
    delayMs: retryable ? Math.round(500 * 2 ** (attempt - 1) * (1 + jitter)) : 0,
  };
}

export function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function redactOperationalError(error: unknown): string {
  const text = error instanceof Error ? error.message : "Ingestion failed";
  return text
    .replace(/https?:\/\/[^\s]+/gi, "[URL]")
    .replace(/bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/(authorization|bearer|token|secret|password|api[-_]?key)\s*[:=]\s*[^\s]+/gi, "$1=[REDACTED]")
    .slice(0, 500);
}
