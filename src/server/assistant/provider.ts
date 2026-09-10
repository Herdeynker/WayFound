import "server-only";

import type { AIProvider } from "@/server/providers";
import { createDisabledAIProvider } from "@/server/providers";
import { parseServerEnvironment } from "@/lib/env/schema";
import type { ZodType } from "zod";

function safeProviderError(status?: number) {
  return new Error(
    status
      ? `The writing provider returned a temporary error (${status}).`
      : "The writing provider did not return a valid response.",
  );
}

export function createGeminiAIProvider(apiKey: string, model: string): AIProvider {
  async function generateStructured<T>(request: {
    operation: string;
    input: unknown;
    outputSchema: ZodType<T>;
  }): Promise<T> {
    const { operation, input, outputSchema } = request;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: JSON.stringify({ operation, input }) }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt === 0) continue;
          throw safeProviderError(response.status);
        }
        const body = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const candidateText = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) throw safeProviderError();
        return outputSchema.parse(JSON.parse(candidateText)) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : safeProviderError();
        if (attempt === 0 && lastError.name === "TimeoutError") continue;
      }
    }
    throw lastError ?? safeProviderError();
  }
  return {
    generateStructured,
  };
}

export function createConfiguredAIProvider(): AIProvider {
  const env = parseServerEnvironment();
  if (env.AI_PROVIDER === "gemini" && env.AI_API_KEY && env.AI_MODEL)
    return createGeminiAIProvider(env.AI_API_KEY, env.AI_MODEL);
  return createDisabledAIProvider();
}
