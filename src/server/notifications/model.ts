import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import {
  notificationEventTypes,
  notificationFrequencies,
  type NotificationEventType,
  type NotificationFrequency,
} from "@/features/notifications/types";

export { notificationEventTypes, notificationFrequencies } from "@/features/notifications/types";
export type {
  NotificationChannel,
  NotificationEventType,
  NotificationFrequency,
} from "@/features/notifications/types";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const notificationPreferencesBaseSchema = z.object({
  email_frequency: z.enum(notificationFrequencies),
  telegram_frequency: z.enum(notificationFrequencies),
  timezone_name: z.string().trim().min(1).max(80),
  quiet_hours_enabled: z.boolean(),
  quiet_hours_start: timeSchema,
  quiet_hours_end: timeSchema,
  event_types: z.array(z.enum(notificationEventTypes)).max(notificationEventTypes.length),
});

function validatePreferences(
  value: z.infer<typeof notificationPreferencesBaseSchema>,
  context: z.RefinementCtx,
) {
  if (new Set(value.event_types).size !== value.event_types.length) {
    context.addIssue({ code: "custom", path: ["event_types"], message: "Choose each alert type once." });
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value.timezone_name }).format(new Date());
  } catch {
    context.addIssue({ code: "custom", path: ["timezone_name"], message: "Choose a valid timezone." });
  }
}

export const notificationPreferencesSchema =
  notificationPreferencesBaseSchema.superRefine(validatePreferences);

export const notificationPreferenceRequestSchema = notificationPreferencesBaseSchema
  .extend({ email_consent: z.boolean(), telegram_consent: z.boolean() })
  .superRefine(validatePreferences);

export const notificationEventSchema = z
  .object({
    userId: z.string().uuid(),
    eventType: z.enum(notificationEventTypes),
    resourceKind: z.enum(["opportunity", "application"]),
    resourceId: z.string().uuid(),
    occurrenceKey: z.string().trim().min(1).max(120),
    occurredAt: z.coerce.date(),
    safeContext: z
      .object({
        days_remaining: z.number().int().min(-1).max(366).optional(),
        urgency: z.enum(["routine", "soon", "urgent"]).optional(),
        status_label: z.enum(["expired", "withdrawn"]).optional(),
      })
      .strict()
      .default({}),
  })
  .superRefine((value, context) => {
    const opportunityEvent = [
      "new_match",
      "strong_match",
      "opportunity_expired",
      "opportunity_withdrawn",
    ].includes(value.eventType);
    if ((opportunityEvent ? "opportunity" : "application") !== value.resourceKind) {
      context.addIssue({
        code: "custom",
        path: ["resourceKind"],
        message: "Resource does not match alert type.",
      });
    }
  });

export const telegramUpdateSchema = z
  .object({
    update_id: z.number().int(),
    message: z
      .object({
        text: z.string().max(180),
        chat: z.object({ id: z.union([z.string(), z.number()]), type: z.string().max(40) }),
        from: z
          .object({ first_name: z.string().max(80).optional(), username: z.string().max(80).optional() })
          .optional(),
      })
      .optional(),
  })
  .strict();

export const internalDeepLinkSchema = z
  .string()
  .regex(
    /^\/(?:opportunities|applications)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

export function deriveDeepLink(resourceKind: "opportunity" | "application", resourceId: string): string {
  return internalDeepLinkSchema.parse(
    `/${resourceKind === "opportunity" ? "opportunities" : "applications"}/${resourceId}`,
  );
}

export function notificationDeduplicationKey(input: z.infer<typeof notificationEventSchema>): string {
  const parsed = notificationEventSchema.parse(input);
  return createHash("sha256")
    .update(
      [parsed.userId, parsed.eventType, parsed.resourceKind, parsed.resourceId, parsed.occurrenceKey].join(
        ":",
      ),
    )
    .digest("hex");
}

export function telegramTokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdays.indexOf(parts.weekday),
  };
}

function zonedDateTimeToUtc(parts: Omit<ZonedParts, "weekday">, timeZone: string): Date {
  let guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  for (let index = 0; index < 3; index += 1) {
    const actual = zonedParts(guess, timeZone);
    const wantedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    guess = new Date(guess.getTime() + wantedUtc - actualUtc);
  }
  return guess;
}

function addLocalDays(parts: ZonedParts, days: number): Omit<ZonedParts, "weekday"> {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function isWithinQuietHours(now: Date, timeZone: string, start: string, end: string): boolean {
  const current = zonedParts(now, timeZone);
  const currentMinutes = current.hour * 60 + current.minute;
  const startMinutes = minutes(start);
  const endMinutes = minutes(end);
  if (startMinutes === endMinutes) return true;
  return startMinutes < endMinutes
    ? currentMinutes >= startMinutes && currentMinutes < endMinutes
    : currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function afterQuietHours(now: Date, timeZone: string, start: string, end: string): Date {
  if (!isWithinQuietHours(now, timeZone, start, end)) return now;
  const current = zonedParts(now, timeZone);
  const endMinutes = minutes(end);
  const currentMinutes = current.hour * 60 + current.minute;
  const wraps = minutes(start) >= endMinutes;
  const addDay = wraps && currentMinutes >= minutes(start) ? 1 : 0;
  const target = addLocalDays(
    { ...current, hour: Math.floor(endMinutes / 60), minute: endMinutes % 60 },
    addDay,
  );
  return zonedDateTimeToUtc(target, timeZone);
}

export function nextDeliveryAt(input: {
  now: Date;
  frequency: NotificationFrequency;
  eventType: NotificationEventType;
  timeZone: string;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
}): Date | null {
  if (input.frequency === "off") return null;
  if (input.frequency === "deadline_only" && input.eventType !== "deadline") return null;
  let due = input.now;
  const local = zonedParts(input.now, input.timeZone);
  if (input.frequency === "daily") {
    const targetDay = local.hour < 9 ? 0 : 1;
    due = zonedDateTimeToUtc({ ...addLocalDays(local, targetDay), hour: 9, minute: 0 }, input.timeZone);
  }
  if (input.frequency === "weekly") {
    const daysUntilMonday = (8 - local.weekday) % 7 || 7;
    due = zonedDateTimeToUtc({ ...addLocalDays(local, daysUntilMonday), hour: 9, minute: 0 }, input.timeZone);
  }
  return input.quietHoursEnabled
    ? afterQuietHours(due, input.timeZone, input.quietStart, input.quietEnd)
    : due;
}

const copy: Record<NotificationEventType, { subject: string; text: string }> = {
  new_match: {
    subject: "A new WAYFOUND match is ready",
    text: "A new opportunity match is ready to review.",
  },
  strong_match: {
    subject: "A strong WAYFOUND match is ready",
    text: "A strong-fit opportunity is ready to review.",
  },
  deadline: {
    subject: "An application deadline needs attention",
    text: "An application deadline is approaching.",
  },
  missing_document: {
    subject: "Your application checklist needs attention",
    text: "A required application item is still incomplete.",
  },
  interview: {
    subject: "Your interview step is ready",
    text: "An application interview step needs your attention.",
  },
  opportunity_expired: {
    subject: "An opportunity status changed",
    text: "A saved opportunity is now marked expired.",
  },
  opportunity_withdrawn: {
    subject: "An opportunity status changed",
    text: "A saved opportunity is now marked withdrawn.",
  },
};

export function renderNotification(input: {
  eventType: NotificationEventType;
  deepLink: string;
  appUrl: string;
}): { subject: string; text: string; url: string } {
  const path = internalDeepLinkSchema.parse(input.deepLink);
  const base = new URL(input.appUrl);
  if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw new Error("Invalid app URL");
  const url = new URL(path, base);
  if (url.origin !== base.origin) throw new Error("Unsafe notification destination");
  return {
    ...copy[input.eventType],
    text: `${copy[input.eventType].text}\n\nOpen in WAYFOUND: ${url}`,
    url: url.toString(),
  };
}
