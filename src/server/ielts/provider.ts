import "server-only";

import type { AIProvider } from "@/server/providers";
import { createConfiguredAIProvider } from "@/server/assistant/provider";
import { buildIeltsFeedbackEnvelope, ieltsFeedbackOutputSchema } from "./model";

export interface IeltsFeedbackProvider {
  evaluate(input: {
    skill: "writing" | "speaking";
    task: string;
    responseText: string;
    rubric: Record<string, unknown>;
  }): Promise<ReturnType<typeof ieltsFeedbackOutputSchema.parse>>;
}

export function createIeltsFeedbackProvider(
  ai: AIProvider = createConfiguredAIProvider(),
): IeltsFeedbackProvider {
  return {
    evaluate: async (input) =>
      ai.generateStructured({
        operation: `ielts_${input.skill}_estimated_feedback`,
        input: buildIeltsFeedbackEnvelope(input),
        outputSchema: ieltsFeedbackOutputSchema,
      }),
  };
}
