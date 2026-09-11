import { afterEach, describe, expect, it, vi } from "vitest";
import {
  afterQuietHours,
  deriveDeepLink,
  internalDeepLinkSchema,
  nextDeliveryAt,
  notificationDeduplicationKey,
  notificationPreferenceRequestSchema,
  renderNotification,
  telegramTokenDigest,
} from "@/server/notifications/model";
import { createResendEmailProvider, createTelegramBotProvider } from "@/server/notifications/providers";
import { createTelegramLinkSecret, telegramLinkUrl } from "@/server/notifications/service";

afterEach(() => vi.unstubAllGlobals());

describe("Phase 11 notification rules", () => {
  const event = {
    userId: "11111111-1111-4111-8111-111111111111",
    eventType: "deadline" as const,
    resourceKind: "application" as const,
    resourceId: "22222222-2222-4222-8222-222222222222",
    occurrenceKey: "deadline:2027-12-31:7-days",
    occurredAt: new Date("2027-12-24T21:30:00.000Z"),
    safeContext: { days_remaining: 7, urgency: "soon" as const },
  };

  it("validates channel choices, IANA timezones and unique event selections", () => {
    expect(
      notificationPreferenceRequestSchema.safeParse({
        email_frequency: "daily",
        telegram_frequency: "off",
        timezone_name: "Africa/Lagos",
        quiet_hours_enabled: true,
        quiet_hours_start: "22:00",
        quiet_hours_end: "07:00",
        event_types: ["deadline", "strong_match"],
        email_consent: true,
        telegram_consent: false,
      }).success,
    ).toBe(true);
    expect(
      notificationPreferenceRequestSchema.safeParse({
        email_frequency: "daily",
        telegram_frequency: "off",
        timezone_name: "Not/A_Real_Zone",
        quiet_hours_enabled: true,
        quiet_hours_start: "25:00",
        quiet_hours_end: "07:00",
        event_types: ["deadline", "deadline"],
        email_consent: true,
        telegram_consent: false,
      }).success,
    ).toBe(false);
  });

  it("deduplicates identical and out-of-order observations deterministically", () => {
    const first = notificationDeduplicationKey(event);
    expect(notificationDeduplicationKey({ ...event, occurredAt: new Date("2027-12-20T00:00:00Z") })).toBe(
      first,
    );
    expect(notificationDeduplicationKey({ ...event, occurrenceKey: "deadline:2027-12-31:1-day" })).not.toBe(
      first,
    );
  });

  it("schedules across overnight quiet hours and supports deadline-only delivery", () => {
    expect(afterQuietHours(event.occurredAt, "Africa/Lagos", "22:00", "07:00").toISOString()).toBe(
      "2027-12-25T06:00:00.000Z",
    );
    expect(
      nextDeliveryAt({
        now: event.occurredAt,
        frequency: "deadline_only",
        eventType: "strong_match",
        timeZone: "Africa/Lagos",
        quietHoursEnabled: false,
        quietStart: "22:00",
        quietEnd: "07:00",
      }),
    ).toBeNull();
    expect(
      nextDeliveryAt({
        now: event.occurredAt,
        frequency: "deadline_only",
        eventType: "deadline",
        timeZone: "Africa/Lagos",
        quietHoursEnabled: true,
        quietStart: "22:00",
        quietEnd: "07:00",
      })?.toISOString(),
    ).toBe("2027-12-25T06:00:00.000Z");
  });

  it("accepts only closed authenticated deep links and generic message copy", () => {
    const link = deriveDeepLink("application", event.resourceId);
    expect(internalDeepLinkSchema.safeParse("https://evil.example/steal").success).toBe(false);
    expect(internalDeepLinkSchema.safeParse("//evil.example").success).toBe(false);
    expect(internalDeepLinkSchema.safeParse(`${link}?next=https://evil.example`).success).toBe(false);
    const message = renderNotification({
      eventType: "deadline",
      deepLink: link,
      appUrl: "https://app.wayfound.example",
    });
    expect(message.url).toBe(`https://app.wayfound.example${link}`);
    expect(message.text).not.toMatch(/passport|cv|document content/i);
  });

  it("stores only a digest for one-time Telegram link secrets", () => {
    const secret = createTelegramLinkSecret();
    expect(secret.digest).toBe(telegramTokenDigest(secret.token));
    expect(secret.digest).not.toContain(secret.token);
    expect(telegramLinkUrl("Wayfound_Test_Bot", secret.token)).toContain(
      "https://t.me/Wayfound_Test_Bot?start=",
    );
    expect(() => telegramLinkUrl("bad user", secret.token)).toThrow();
  });

  it("retries one transient Resend response and returns a bounded receipt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ id: "email-request-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const receipt = await createResendEmailProvider("server-secret", "WAYFOUND <alerts@example.test>").send({
      to: "user@example.test",
      subject: "WAYFOUND update",
      text: "Open your account.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(receipt).toMatchObject({ provider: "email", requestId: "email-request-1" });
  });

  it("validates Telegram output and keeps its token out of the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true, result: { message_id: 42 } }));
    vi.stubGlobal("fetch", fetchMock);
    const receipt = await createTelegramBotProvider("server-token").sendMessage("10001", "A safe alert");
    expect(receipt.requestId).toBe("42");
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain("server-token");
  });
});
