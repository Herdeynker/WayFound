"use client";

import { useState } from "react";
import { Button, Card, Checkbox } from "@/components/ui";

type Props = {
  email: string;
  preferences: { email_enabled: boolean; telegram_enabled: boolean };
  exportRequested: boolean;
  deletionRequested: boolean;
  deletionRequestId?: string;
};

export function AccountSettings({
  email,
  preferences,
  exportRequested,
  deletionRequested,
  deletionRequestId,
}: Props) {
  const [emailEnabled, setEmailEnabled] = useState(preferences.email_enabled);
  const [telegramEnabled, setTelegramEnabled] = useState(preferences.telegram_enabled);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function action(path: string, payload: Record<string, unknown> = {}) {
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error ?? "We could not complete that request.");
    else setMessage(data.message ?? "Saved.");
    setPending(false);
  }
  return (
    <div className="settings-stack">
      <Card>
        <p className="card-eyebrow">Account</p>
        <h2>Keep your account in your hands</h2>
        <p className="settings-muted">
          Signed in as <strong>{email}</strong>
        </p>
        <div className="settings-actions">
          <a className="ui-button ui-button-secondary" href="/forgot-password">
            Change password <span aria-hidden="true">→</span>
          </a>
          <Button variant="quiet" onClick={() => action("/api/auth/logout")}>
            Sign out this device
          </Button>
          <Button variant="quiet" onClick={() => action("/api/auth/logout", { all: true })}>
            Sign out everywhere
          </Button>
        </div>
      </Card>
      <Card>
        <p className="card-eyebrow">Notifications</p>
        <h2>Choose what reaches you</h2>
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            action("/api/settings/notifications", {
              email_enabled: emailEnabled,
              telegram_enabled: telegramEnabled,
            });
          }}
        >
          <Checkbox
            checked={emailEnabled}
            label="Email opportunity and deadline alerts"
            onChange={(event) => setEmailEnabled(event.target.checked)}
          />
          <Checkbox
            checked={telegramEnabled}
            label="Telegram alerts (after I link an account)"
            onChange={(event) => setTelegramEnabled(event.target.checked)}
          />
          <Button loading={pending} type="submit">
            Save preferences
          </Button>
        </form>
      </Card>
      <Card>
        <p className="card-eyebrow">Your data</p>
        <h2>Export or delete your account</h2>
        <p className="settings-muted">
          Requests enter a protected queue. Delivery and retention timing follow the policy configured for
          this environment.
        </p>
        <div className="settings-actions">
          <Button disabled={exportRequested} onClick={() => action("/api/account/export")}>
            {exportRequested ? "Export request pending" : "Request a data export"}
          </Button>
          <Button
            variant="secondary"
            disabled={deletionRequested}
            onClick={() => {
              if (window.confirm("Request account deletion? You will have a grace period to cancel."))
                action("/api/account/delete", { confirmation: "DELETE" });
            }}
          >
            {deletionRequested ? "Deletion request pending" : "Request account deletion"}
          </Button>
          {deletionRequested && deletionRequestId ? (
            <Button
              variant="quiet"
              onClick={() => action("/api/account/delete/cancel", { requestId: deletionRequestId })}
            >
              Cancel deletion request
            </Button>
          ) : null}
        </div>
        <p className="settings-danger-note">
          Deletion is not immediate. You can cancel a pending request during the grace period.
        </p>
      </Card>
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
    </div>
  );
}
