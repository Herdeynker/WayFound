import "server-only";

import { z } from "zod";
import { canonicalizeDiscoveryUrl } from "./model";
import { searchResultSchema, type SearchProvider, type SearchResponse } from "./types";

const braveResultSchema = z
  .object({
    title: z.string().trim().min(1).max(2000),
    url: z.string().url().max(4096),
    description: z.string().max(8000).optional(),
    language: z.string().max(20).optional(),
    profile: z
      .object({ long_name: z.string().max(240).optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();
const braveResponseSchema = z
  .object({
    web: z
      .object({ results: z.array(braveResultSchema).max(20) })
      .passthrough()
      .optional(),
  })
  .passthrough();

const stripUnsupportedText = (value: string) => value.replaceAll("\u0000", "");

export class SearchProviderError extends Error {
  constructor(
    readonly code:
      "rate_limited" | "quota_exhausted" | "provider_timeout" | "provider_failure" | "invalid_response",
    readonly retryable: boolean,
  ) {
    super(`Search provider unavailable (${code}).`);
    this.name = "SearchProviderError";
  }
}

export class BraveSearchProvider implements SearchProvider {
  readonly name = "brave" as const;

  constructor(
    private readonly apiKey: string,
    private readonly request: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) throw new Error("Brave Search is not configured.");
  }

  async search(query: string, resultCount: number, signal?: AbortSignal): Promise<SearchResponse> {
    if (query.length < 10 || query.length > 500)
      throw new Error("Search query is outside the supported bounds.");
    if (!Number.isInteger(resultCount) || resultCount < 1 || resultCount > 20)
      throw new Error("Search result count is outside the zero-cost boundary.");
    let response: Response;
    try {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(resultCount));
      url.searchParams.set("safesearch", "strict");
      url.searchParams.set("search_lang", "en");
      url.searchParams.set("spellcheck", "1");
      response = await this.request(url, {
        method: "GET",
        redirect: "error",
        signal: signal ?? AbortSignal.timeout(10_000),
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": this.apiKey,
          "User-Agent": "WAYFOUND-Opportunity-Discovery/1.0",
        },
      });
    } catch (error) {
      if (error instanceof SearchProviderError) throw error;
      throw new SearchProviderError("provider_timeout", true);
    }
    if (response.status === 429) throw new SearchProviderError("rate_limited", false);
    if (response.status === 402 || response.status === 403)
      throw new SearchProviderError("quota_exhausted", false);
    if (!response.ok) throw new SearchProviderError("provider_failure", response.status >= 500);
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > 1_048_576) throw new SearchProviderError("invalid_response", false);
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new SearchProviderError("invalid_response", false);
    }
    const parsed = braveResponseSchema.safeParse(raw);
    if (!parsed.success) throw new SearchProviderError("invalid_response", false);
    const results = (parsed.data.web?.results ?? []).slice(0, resultCount).flatMap((item, index) => {
      try {
        const canonicalUrl = canonicalizeDiscoveryUrl(item.url);
        const hostname = new URL(canonicalUrl).hostname;
        if (!/^[a-z0-9.-]{1,253}$/.test(hostname)) return [];
        return [
          searchResultSchema.parse({
            url: canonicalUrl,
            title: stripUnsupportedText(item.title).slice(0, 500),
            snippet: stripUnsupportedText(item.description ?? "").slice(0, 1000),
            position: index + 1,
            language: /^[a-z]{2,3}(-[A-Z]{2})?$/.test(item.language ?? "") ? item.language : undefined,
            providerResultId: item.profile?.long_name
              ? stripUnsupportedText(item.profile.long_name).slice(0, 240)
              : undefined,
          }),
        ];
      } catch {
        return [];
      }
    });
    return {
      results,
      providerRequestId:
        response.headers.get("x-request-id")?.slice(0, 160) ??
        response.headers.get("x-trace-id")?.slice(0, 160) ??
        undefined,
    };
  }
}
