import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

const optionalText = z.preprocess(emptyToUndefined, z.string().min(1).optional());

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: optionalText,
  NEXT_PUBLIC_SUPABASE_URL: optionalText,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalText,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalText,
  NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional()),
});

export const serverEnvironmentSchema = z.object({
  APP_URL: optionalText,
  SUPABASE_URL: optionalText,
  SUPABASE_SECRET_KEY: optionalText,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  AI_PROVIDER: optionalText,
  AI_API_KEY: optionalText,
  AI_MODEL: optionalText,
  DISCOVERY_PROVIDER: optionalText,
  DISCOVERY_API_KEY: optionalText,
  RESEND_API_KEY: optionalText,
  NOTIFICATION_EMAIL_FROM: optionalText,
  TELEGRAM_BOT_TOKEN: optionalText,
  TELEGRAM_BOT_USERNAME: optionalText,
  TELEGRAM_WEBHOOK_SECRET: optionalText,
  NOTIFICATIONS_CRON_ENABLED: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional()),
  NOTIFICATION_BATCH_SIZE: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).optional()),
  PAYMENT_PROVIDER: optionalText,
  PAYSTACK_SECRET_KEY: optionalText,
  PAYSTACK_WEEKLY_PLAN_CODE: optionalText,
  PAYSTACK_MONTHLY_PLAN_CODE: optionalText,
  PAYSTACK_YEARLY_PLAN_CODE: optionalText,
  PAYSTACK_ENVIRONMENT: z.preprocess(emptyToUndefined, z.enum(["test", "live"]).optional()),
  BILLING_CRON_ENABLED: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional()),
  BILLING_BATCH_SIZE: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).optional()),
  SENTRY_DSN: optionalText,
  CRON_SECRET: optionalText,
  INGESTION_CRON_ENABLED: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional()),
  INGESTION_MAX_SOURCES: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(8).optional()),
  UPLOAD_SCANNER_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["clamav_http"]).optional()),
  UPLOAD_SCANNER_URL: optionalText,
  UPLOAD_SCANNER_TOKEN: optionalText,
  UPLOAD_SCANNER_ALLOWED_HOST: optionalText,
  FEATURE_FLAGS_JSON: optionalText,
  GOOGLE_OAUTH_ENABLED: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional()),
  PHASE2_POLICY_VERSION: optionalText,
  ACCOUNT_DELETION_GRACE_DAYS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(365).optional(),
  ),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parsePublicEnvironment(input: NodeJS.ProcessEnv = process.env): PublicEnvironment {
  return publicEnvironmentSchema.parse(input);
}

export function parseServerEnvironment(input: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  const parsed = serverEnvironmentSchema.parse(input);
  if (input.NODE_ENV === "production") {
    const missing: string[] = ["APP_URL", "SUPABASE_URL"].filter(
      (key) => !parsed[key as keyof ServerEnvironment],
    );
    if (!parsed.SUPABASE_SECRET_KEY && !parsed.SUPABASE_SERVICE_ROLE_KEY) {
      missing.push("SUPABASE_SECRET_KEY");
    }
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
    }
  }
  return parsed;
}
