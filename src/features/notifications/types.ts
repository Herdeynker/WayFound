export const notificationEventTypes = [
  "new_match",
  "strong_match",
  "deadline",
  "missing_document",
  "interview",
  "opportunity_expired",
  "opportunity_withdrawn",
] as const;

export const notificationFrequencies = ["off", "instant", "daily", "weekly", "deadline_only"] as const;
export const notificationChannels = ["email", "telegram"] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];
export type NotificationFrequency = (typeof notificationFrequencies)[number];
export type NotificationChannel = (typeof notificationChannels)[number];
