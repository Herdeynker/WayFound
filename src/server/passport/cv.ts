import "server-only";

import { z } from "zod";
import { createDisabledAIProvider, ProviderDisabledError } from "@/server/providers";

export const cvSuggestionSchema = z
  .object({
    suggestions: z
      .array(
        z.object({
          fieldPath: z.enum([
            "preferredName",
            "education",
            "employment",
            "skills",
            "certifications",
            "trade",
          ]),
          proposedValue: z.unknown(),
          evidence: z.string().max(240),
        }),
      )
      .max(40),
    provider: z.string().max(80),
    schemaVersion: z.literal("phase3.cv.v1"),
  })
  .strict();

export async function requestCvSuggestions(input: { text: string; consentGranted: boolean }) {
  if (!input.consentGranted) throw new Error("AI processing consent is required before CV parsing.");
  if (input.text.length > 50_000) throw new Error("This document is too large to process safely.");
  try {
    return await createDisabledAIProvider().generateStructured({
      operation: "parse_cv",
      input: { text: input.text },
      outputSchema: cvSuggestionSchema,
    });
  } catch (error) {
    if (error instanceof ProviderDisabledError) throw error;
    throw new Error("CV suggestions were rejected because the provider response was invalid.");
  }
}
