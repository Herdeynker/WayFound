"use client";

import React, { useState } from "react";
import { Badge, Button, Card, Checkbox, FormField, Select, Skeleton } from "@/components/ui";
import { notificationEventTypes, type NotificationEventType, type NotificationFrequency } from "./types";

export type NotificationPreferencesView = {
  email: string;
  emailVerified: boolean;
  emailConsented: boolean;
  telegramConsented: boolean;
  emailFrequency: NotificationFrequency;
  telegramFrequency: NotificationFrequency;
  timezone: string;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  eventTypes: NotificationEventType[];
  telegramLinked: boolean;
  telegramLabel?: string;
  emailProviderConfigured: boolean;
  telegramProviderConfigured: boolean;
  recentDeliveries: Array<{
    id: string;
    label: string;
    channel: "email" | "telegram";
    status: "sent" | "scheduled" | "retry" | "suppressed" | "permanent_failure";
    deepLink: string;
  }>;
};

export type NotificationViewState =
  "ready" | "empty" | "success" | "loading" | "error" | "interrupted" | "stale" | "permission" | "disabled";

const eventLabels: Record<NotificationEventType, string> = {
  new_match: "New matches",
  strong_match: "Strong matches",
  deadline: "Application deadlines",
  missing_document: "Missing documents",
  interview: "Interview steps",
  opportunity_expired: "Expired opportunities",
  opportunity_withdrawn: "Withdrawn opportunities",
};

const frequencyOptions: Array<{ value: NotificationFrequency; label: string }> = [
  { value: "off", label: "Off" },
  { value: "instant", label: "Instant" },
  { value: "daily", label: "Daily digest" },
  { value: "weekly", label: "Weekly digest" },
  { value: "deadline_only", label: "Deadline only" },
];

export function NotificationPreferences({
  initial,
  state = "ready",
  fixture = false,
}: {
  initial: NotificationPreferencesView;
  state?: NotificationViewState;
  fixture?: boolean;
}) {
  const [model, setModel] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function post(path: string, body: unknown = {}) {
    if (fixture) return { ok: true, message: "Your alert choices are saved.", url: "" };
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "That change could not be saved.");
    return data;
  }

  async function save() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await post("/api/settings/notifications", {
        email_frequency: model.emailFrequency,
        telegram_frequency: model.telegramFrequency,
        email_consent: model.emailConsented,
        telegram_consent: model.telegramConsented,
        timezone_name: model.timezone,
        quiet_hours_enabled: model.quietHoursEnabled,
        quiet_hours_start: model.quietStart,
        quiet_hours_end: model.quietEnd,
        event_types: model.eventTypes,
      });
      setMessage("Your alert choices are saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your alert choices could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function linkTelegram() {
    setPending(true);
    setError("");
    try {
      if (fixture) {
        setModel((current) => ({ ...current, telegramLinked: true, telegramLabel: "Linked privately" }));
        setMessage("Telegram is linked. Choose when alerts may reach you.");
      } else {
        const result = await post("/api/notifications/telegram/link");
        window.location.assign(result.url);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Telegram linking could not start.");
    } finally {
      setPending(false);
    }
  }

  async function unlinkTelegram() {
    setPending(true);
    setError("");
    try {
      await post("/api/notifications/telegram/unlink");
      setModel((current) => ({
        ...current,
        telegramLinked: false,
        telegramLabel: undefined,
        telegramFrequency: "off",
      }));
      setMessage("Telegram is unlinked and Telegram alerts are off.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Telegram could not be unlinked.");
    } finally {
      setPending(false);
    }
  }

  if (state === "loading") return <NotificationLoading />;
  if (state === "permission")
    return (
      <NotificationState
        tone="error"
        title="Alerts are private"
        text="Sign in again to review alert settings. No delivery details were shown."
      />
    );

  return (
    <div className="notification-settings" data-testid="notification-settings">
      <section className="notification-intro" aria-labelledby="notification-title">
        <div>
          <p className="card-eyebrow">Bring the right moment closer</p>
          <h2 id="notification-title">Alerts that respect your time</h2>
          <p>
            Choose useful updates, quiet hours and a channel. Nothing here changes your matches or
            applications.
          </p>
        </div>
        <span className="notification-route" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </section>

      {state === "error" ? (
        <NotificationState
          tone="error"
          title="Preferences could not load"
          text="Your existing choices were not changed. Try again when the connection is stable."
        />
      ) : null}
      {state === "success" ? (
        <NotificationState
          tone="slate"
          title="Alert choices saved"
          text="New events will follow these channel, frequency and quiet-hour choices."
        />
      ) : null}
      {state === "interrupted" ? (
        <NotificationState
          tone="amber"
          title="Saving was interrupted"
          text="Review these choices and save again. No success was recorded."
        />
      ) : null}
      {state === "stale" ? (
        <NotificationState
          tone="amber"
          title="Your alert settings changed elsewhere"
          text="Refresh before saving so a newer choice is not overwritten."
        />
      ) : null}
      {state === "disabled" ? (
        <NotificationState
          tone="slate"
          title="Delivery providers are not configured"
          text="Your choices can be prepared, but WAYFOUND will not claim that messages are being delivered."
        />
      ) : null}

      <div className="notification-grid">
        <Card className="notification-card notification-channel-card">
          <div className="notification-card-heading">
            <div>
              <p className="card-eyebrow">Channels</p>
              <h3>Email and Telegram</h3>
            </div>
            <Badge tone={model.emailVerified ? "teal" : "amber"}>
              {model.emailVerified ? "Email verified" : "Verify email"}
            </Badge>
          </div>
          <p className="settings-muted">
            Email alerts go only to <strong>{model.email}</strong>.
          </p>
          <div className="notification-consent-row">
            <Checkbox
              checked={model.emailConsented}
              label="I agree to receive the email alerts I select"
              onChange={(event) =>
                setModel({
                  ...model,
                  emailConsented: event.target.checked,
                  emailFrequency: event.target.checked ? model.emailFrequency : "off",
                })
              }
            />
            <Checkbox
              checked={model.telegramConsented}
              label="I agree to receive the Telegram alerts I select"
              onChange={(event) =>
                setModel({
                  ...model,
                  telegramConsented: event.target.checked,
                  telegramFrequency: event.target.checked ? model.telegramFrequency : "off",
                })
              }
            />
          </div>
          <div className="notification-channel-row">
            <FormField
              label="Email frequency"
              hint={
                !model.emailProviderConfigured
                  ? "Email delivery is not configured in this environment."
                  : undefined
              }
            >
              <Select
                disabled={!model.emailVerified || !model.emailConsented || state === "stale"}
                value={model.emailFrequency}
                onChange={(event) =>
                  setModel({ ...model, emailFrequency: event.target.value as NotificationFrequency })
                }
              >
                {frequencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Telegram frequency"
              hint={!model.telegramLinked ? "Link Telegram before turning this channel on." : undefined}
            >
              <Select
                disabled={!model.telegramLinked || !model.telegramConsented || state === "stale"}
                value={model.telegramFrequency}
                onChange={(event) =>
                  setModel({ ...model, telegramFrequency: event.target.value as NotificationFrequency })
                }
              >
                {frequencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="telegram-link-panel">
            <div>
              <strong>{model.telegramLinked ? "Telegram linked" : "Telegram is not linked"}</strong>
              <span>
                {model.telegramLinked
                  ? (model.telegramLabel ?? "Private account")
                  : "A one-time link expires after 15 minutes."}
              </span>
            </div>
            {model.telegramLinked ? (
              <Button disabled={pending} onClick={unlinkTelegram} variant="quiet">
                Unlink Telegram
              </Button>
            ) : (
              <Button
                disabled={pending || !model.telegramProviderConfigured || !model.telegramConsented}
                onClick={linkTelegram}
                variant="secondary"
              >
                Link Telegram
              </Button>
            )}
          </div>
        </Card>

        <Card className="notification-card">
          <p className="card-eyebrow">Timing</p>
          <h3>Protect your quiet hours</h3>
          <FormField label="Timezone" hint="Deadlines and quiet hours use this timezone.">
            <Select
              value={model.timezone}
              onChange={(event) => setModel({ ...model, timezone: event.target.value })}
            >
              <option value="Africa/Lagos">West Africa · Lagos</option>
              <option value="Africa/Accra">Greenwich Mean Time · Accra</option>
              <option value="Africa/Nairobi">East Africa · Nairobi</option>
              <option value="Europe/London">United Kingdom · London</option>
              <option value="America/Toronto">Canada · Toronto</option>
            </Select>
          </FormField>
          <Checkbox
            checked={model.quietHoursEnabled}
            label="Pause non-urgent delivery during quiet hours"
            onChange={(event) => setModel({ ...model, quietHoursEnabled: event.target.checked })}
          />
          <div className="quiet-hours-row">
            <FormField label="Quiet from">
              <input
                className="ui-input"
                type="time"
                value={model.quietStart}
                onChange={(event) => setModel({ ...model, quietStart: event.target.value })}
              />
            </FormField>
            <FormField label="Until">
              <input
                className="ui-input"
                type="time"
                value={model.quietEnd}
                onChange={(event) => setModel({ ...model, quietEnd: event.target.value })}
              />
            </FormField>
          </div>
        </Card>

        <Card className="notification-card notification-events-card">
          <p className="card-eyebrow">Useful moments only</p>
          <h3>What should bring you back?</h3>
          <div className="notification-event-grid">
            {notificationEventTypes.map((eventType) => (
              <Checkbox
                key={eventType}
                checked={model.eventTypes.includes(eventType)}
                label={eventLabels[eventType]}
                onChange={(event) =>
                  setModel({
                    ...model,
                    eventTypes: event.target.checked
                      ? [...model.eventTypes, eventType]
                      : model.eventTypes.filter((item) => item !== eventType),
                  })
                }
              />
            ))}
          </div>
        </Card>

        <Card className="notification-card notification-history-card">
          <div className="notification-card-heading">
            <div>
              <p className="card-eyebrow">Delivery history</p>
              <h3>Recent alerts</h3>
            </div>
            <Badge tone="slate">Private</Badge>
          </div>
          {model.recentDeliveries.length ? (
            <ul className="notification-history">
              {model.recentDeliveries.map((delivery) => (
                <li key={delivery.id}>
                  <div>
                    <strong>{delivery.label}</strong>
                    <span>
                      {delivery.channel === "email" ? "Email" : "Telegram"} ·{" "}
                      {delivery.status.replace("_", " ")}
                    </span>
                  </div>
                  <a href={delivery.deepLink}>
                    Open <span aria-hidden="true">→</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="notification-empty">No alerts yet. Your first useful update will appear here.</p>
          )}
        </Card>
      </div>

      <div className="notification-actions">
        <Button disabled={state === "stale"} loading={pending} onClick={save}>
          Save alert choices
        </Button>
        <a href="/settings/privacy">Review notification consent</a>
      </div>
      {message ? (
        <p className="auth-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="notification-privacy-note">
        Alerts use short, general summaries. Private documents, CV contents and profile details are never
        placed in message bodies.
      </p>
    </div>
  );
}

function NotificationState({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: "error" | "amber" | "slate";
}) {
  return (
    <section
      className={`notification-state notification-state-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      <span>{text}</span>
    </section>
  );
}

function NotificationLoading() {
  return (
    <div className="notification-settings" aria-label="Loading alert preferences" role="status">
      <section className="notification-intro">
        <div>
          <Skeleton className="notification-skeleton-short" />
          <Skeleton className="notification-skeleton-title" />
          <Skeleton />
        </div>
      </section>
      <div className="notification-grid">
        <Card className="notification-card">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </Card>
        <Card className="notification-card">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </Card>
      </div>
    </div>
  );
}
