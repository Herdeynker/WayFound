import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(80).optional(),
});

export const emailSchema = z.object({ email: z.string().trim().email().max(254) });

export const consentSchema = z.object({
  profile_matching: z.boolean(),
  ai_processing: z.boolean(),
  document_storage: z.boolean(),
  email_notifications: z.boolean().default(false),
  telegram_notifications: z.boolean().default(false),
  notifications: z.boolean().optional(),
});

export const preferencesSchema = z.object({
  email_enabled: z.boolean(),
  telegram_enabled: z.boolean(),
});

export const deletionConfirmationSchema = z.object({ confirmation: z.literal("DELETE") });

export function issueMessages(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the highlighted fields.";
}
