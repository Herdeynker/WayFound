import {
  NotificationPreferences,
  type NotificationPreferencesView,
  type NotificationViewState,
} from "@/features/notifications/notification-preferences";
import type { NotificationEventType, NotificationFrequency } from "@/features/notifications/types";
import { parseServerEnvironment } from "@/lib/env/schema";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";

const fixture: NotificationPreferencesView = {
  email: "amara@example.test",
  emailVerified: true,
  emailConsented: true,
  telegramConsented: true,
  emailFrequency: "daily",
  telegramFrequency: "instant",
  timezone: "Africa/Lagos",
  quietHoursEnabled: true,
  quietStart: "22:00",
  quietEnd: "07:00",
  eventTypes: ["strong_match", "deadline", "missing_document", "interview"],
  telegramLinked: true,
  telegramLabel: "Linked privately",
  emailProviderConfigured: true,
  telegramProviderConfigured: true,
  recentDeliveries: [
    {
      id: "one",
      label: "Strong match ready",
      channel: "telegram",
      status: "sent",
      deepLink: "/opportunities/11111111-1111-4111-8111-111111111111",
    },
    {
      id: "two",
      label: "Deadline reminder",
      channel: "email",
      status: "scheduled",
      deepLink: "/applications/22222222-2222-4222-8222-222222222222",
    },
  ],
};

const allowedStates = new Set<NotificationViewState>([
  "ready",
  "empty",
  "success",
  "loading",
  "error",
  "interrupted",
  "stale",
  "permission",
  "disabled",
]);

const eventLabel: Record<string, string> = {
  new_match: "New match ready",
  strong_match: "Strong match ready",
  deadline: "Deadline reminder",
  missing_document: "Missing document reminder",
  interview: "Interview step",
  opportunity_expired: "Opportunity expired",
  opportunity_withdrawn: "Opportunity withdrawn",
};

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const stateValue = (await searchParams).state ?? "ready";
  const state: NotificationViewState = allowedStates.has(stateValue as NotificationViewState)
    ? (stateValue as NotificationViewState)
    : "ready";
  if (await isTestFixtureRequest()) {
    const model =
      state === "disabled"
        ? {
            ...fixture,
            telegramLinked: false,
            telegramFrequency: "off" as const,
            emailProviderConfigured: false,
            telegramProviderConfigured: false,
            recentDeliveries: [],
          }
        : state === "error" || state === "loading" || state === "permission" || state === "empty"
          ? { ...fixture, recentDeliveries: [] }
          : fixture;
    return <NotificationPreferences fixture initial={model} state={state} />;
  }

  const { user, client } = await requireConsentedUser();
  if (!user) return null;
  const [preferences, telegram, deliveries, consents] = await Promise.all([
    client
      .from("notification_preferences")
      .select(
        "email_frequency,telegram_frequency,timezone_name,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,event_types",
      )
      .eq("user_id", user.id)
      .single(),
    client
      .from("telegram_links")
      .select("display_label,status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    client
      .from("notification_deliveries")
      .select("id,channel,status,notification_events(event_type,deep_link)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    client
      .from("user_consents")
      .select("consent_type,granted,recorded_at")
      .eq("user_id", user.id)
      .in("consent_type", ["email_notifications", "telegram_notifications"])
      .order("recorded_at", { ascending: false }),
  ]);
  const env = parseServerEnvironment();
  const row = preferences.data;
  const latestConsent = (type: string) =>
    consents.data?.find((item) => item.consent_type === type)?.granted === true;
  return (
    <NotificationPreferences
      initial={{
        email: user.email ?? "your account email",
        emailVerified: Boolean(user.email_confirmed_at),
        emailConsented: latestConsent("email_notifications"),
        telegramConsented: latestConsent("telegram_notifications"),
        emailFrequency: (row?.email_frequency ?? "off") as NotificationFrequency,
        telegramFrequency: (row?.telegram_frequency ?? "off") as NotificationFrequency,
        timezone: row?.timezone_name ?? "Africa/Lagos",
        quietHoursEnabled: row?.quiet_hours_enabled ?? false,
        quietStart: (row?.quiet_hours_start ?? "22:00").slice(0, 5),
        quietEnd: (row?.quiet_hours_end ?? "07:00").slice(0, 5),
        eventTypes: (row?.event_types ?? []) as NotificationEventType[],
        telegramLinked: Boolean(telegram.data),
        telegramLabel: telegram.data?.display_label ?? undefined,
        emailProviderConfigured: Boolean(env.RESEND_API_KEY && env.NOTIFICATION_EMAIL_FROM),
        telegramProviderConfigured: Boolean(
          env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME && env.TELEGRAM_WEBHOOK_SECRET,
        ),
        recentDeliveries: (deliveries.data ?? []).flatMap((delivery) => {
          const relation = delivery.notification_events;
          const event = Array.isArray(relation) ? relation[0] : relation;
          return event
            ? [
                {
                  id: delivery.id,
                  label: eventLabel[event.event_type] ?? "WAYFOUND alert",
                  channel: delivery.channel as "email" | "telegram",
                  status:
                    delivery.status as NotificationPreferencesView["recentDeliveries"][number]["status"],
                  deepLink: event.deep_link,
                },
              ]
            : [];
        }),
      }}
      state={state}
    />
  );
}
