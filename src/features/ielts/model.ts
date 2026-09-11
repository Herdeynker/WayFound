import { z } from "zod";
import { ieltsTestTypes, type IeltsSkill } from "./types";

export const ieltsProfileSchema = z
  .object({
    testType: z.enum(ieltsTestTypes),
    targetBand: z
      .number()
      .min(1)
      .max(9)
      .refine((value) => Number.isInteger(value * 2)),
    testDate: z.string().date().nullable(),
    recordingRetentionDays: z.number().int().min(1).max(365),
  })
  .strict();

export const readingSubmissionSchema = z
  .object({
    contentId: z.string().uuid(),
    attemptKind: z.enum(["diagnostic", "practice"]),
    idempotencyKey: z.string().uuid(),
    answers: z
      .record(z.string().regex(/^[a-z0-9_-]{1,80}$/), z.string().trim().max(120))
      .refine((answers) => Object.keys(answers).length <= 40, "Too many answers"),
    elapsedSeconds: z.number().int().min(0).max(7200),
  })
  .strict();

export const feedbackRequestSchema = z
  .object({
    contentId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
    skill: z.enum(["writing", "speaking"]),
    responseText: z.string().trim().min(40).max(12000),
    elapsedSeconds: z.number().int().min(0).max(7200),
    recordingId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.skill === "speaking" && !value.recordingId)
      context.addIssue({ code: "custom", message: "A private speaking recording is required." });
    if (value.skill === "writing" && value.recordingId)
      context.addIssue({ code: "custom", message: "Writing feedback cannot use a recording." });
  });

export const speakingUploadMetadataSchema = z
  .object({
    contentId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
    transcript: z.string().trim().min(20).max(12000),
    retentionDays: z.coerce.number().int().min(1).max(365),
  })
  .strict();

const feedbackDimensionSchema = z
  .object({
    criterion: z.enum(["task_response", "coherence", "lexical_resource", "grammar", "fluency"]),
    estimatedBand: z
      .number()
      .min(1)
      .max(9)
      .refine((value) => Number.isInteger(value * 2)),
    note: z.string().trim().min(5).max(500),
  })
  .strict();

export const ieltsFeedbackOutputSchema = z
  .object({
    schemaVersion: z.literal("phase13.feedback.v1"),
    estimatedBand: z
      .number()
      .min(1)
      .max(9)
      .refine((value) => Number.isInteger(value * 2)),
    dimensions: z.array(feedbackDimensionSchema).min(2).max(8),
    strengths: z.array(z.string().trim().min(3).max(300)).max(8),
    recommendations: z.array(z.string().trim().min(3).max(300)).min(1).max(8),
    summary: z.string().trim().min(10).max(2000),
  })
  .strict();

export const readingContentSchema = z
  .object({
    passage: z.string().trim().min(100).max(10000),
    questions: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9_-]{1,80}$/),
            prompt: z.string().trim().min(5).max(500),
            options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict();

export const writingContentSchema = z
  .object({ prompt: z.string().trim().min(20).max(4000), minimum_words: z.number().int().min(20).max(2000) })
  .strict();

export const speakingContentSchema = z
  .object({
    prompt: z.string().trim().min(20).max(2000),
    preparation_seconds: z.number().int().min(0).max(300),
    speaking_seconds: z.number().int().min(30).max(600),
  })
  .strict();

export function estimatedReadingBand(correct: number, total: number): number {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total < 1 || correct < 0 || correct > total)
    throw new Error("A valid reading score is required.");
  return Math.round((3 + (6 * correct) / total) * 2) / 2;
}

export function scoreReadingAnswers(answers: Record<string, string>, answerKey: Record<string, string>) {
  const entries = Object.entries(answerKey);
  if (!entries.length || entries.length > 40) throw new Error("A bounded answer key is required.");
  const correct = entries.filter(
    ([key, expected]) => answers[key]?.trim().toLowerCase() === expected.toLowerCase(),
  ).length;
  return { correct, total: entries.length, estimatedBand: estimatedReadingBand(correct, entries.length) };
}

export function remainingSeconds(durationSeconds: number, elapsedSeconds: number, sinceResumeSeconds = 0) {
  if (![durationSeconds, elapsedSeconds, sinceResumeSeconds].every(Number.isFinite)) return 0;
  return Math.max(
    0,
    Math.floor(durationSeconds - Math.max(0, elapsedSeconds) - Math.max(0, sinceResumeSeconds)),
  );
}

export function buildWeakAreaRecommendation(scoreRatio: number): {
  weakAreas: IeltsSkill[];
  headline: string;
  nextSteps: string[];
  minutesPerDay: number;
} {
  if (!Number.isFinite(scoreRatio) || scoreRatio < 0 || scoreRatio > 1)
    throw new Error("A score ratio from zero to one is required.");
  if (scoreRatio < 0.5)
    return {
      weakAreas: ["reading", "writing", "speaking"],
      headline: "Build reading accuracy before increasing speed.",
      nextSteps: [
        "Review evidence words in each question.",
        "Complete one short timed reading task.",
        "Add writing and speaking samples.",
      ],
      minutesPerDay: 30,
    };
  if (scoreRatio < 0.75)
    return {
      weakAreas: ["reading", "writing", "speaking"],
      headline: "Balance careful reading with timed practice.",
      nextSteps: [
        "Review incorrect answers.",
        "Repeat a timed reading task.",
        "Add writing and speaking samples.",
      ],
      minutesPerDay: 30,
    };
  return {
    weakAreas: ["writing", "speaking"],
    headline: "Maintain reading strength and complete writing and speaking practice.",
    nextSteps: ["Complete a writing task.", "Complete a speaking task.", "Review progress weekly."],
    minutesPerDay: 25,
  };
}

export function isContentApprovedForPractice(content: {
  provenanceType: string;
  licenceStatus: string;
  status: string;
  licenceReference?: string | null;
}) {
  return (
    ["original", "licensed"].includes(content.provenanceType) &&
    content.licenceStatus === "approved" &&
    content.status === "active" &&
    (content.provenanceType === "original" || Boolean(content.licenceReference?.trim()))
  );
}

export const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
