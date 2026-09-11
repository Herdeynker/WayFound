"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

type Props = {
  email: string;
  exportRequested: boolean;
  deletionRequested: boolean;
  deletionRequestId?: string;
};

export function AccountSettings({ email, exportRequested, deletionRequested, deletionRequestId }: Props) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
          <Button disabled={pending} variant="quiet" onClick={() => action("/api/auth/logout")}>
            Sign out this device
          </Button>
          <Button
            disabled={pending}
            variant="quiet"
            onClick={() => action("/api/auth/logout", { all: true })}
          >
            Sign out everywhere
          </Button>
        </div>
      </Card>
      <Card>
        <p className="card-eyebrow">Notifications</p>
        <h2>Choose what reaches you</h2>
        <p className="settings-muted">
          Set frequencies, quiet hours, event types and securely link Telegram in the alert preference centre.
        </p>
        <a className="ui-button ui-button-secondary" href="/settings/notifications">
          Open alert preferences <span aria-hidden="true">→</span>
        </a>
      </Card>
      <Card>
        <p className="card-eyebrow">Your data</p>
        <h2>Export or delete your account</h2>
        <p className="settings-muted">
          Requests enter a protected queue. Delivery and retention timing follow the policy configured for
          this environment.
        </p>
        <div className="settings-actions">
          <Button disabled={pending || exportRequested} onClick={() => action("/api/account/export")}>
            {exportRequested ? "Export request pending" : "Request a data export"}
          </Button>
          <Button
            variant="secondary"
            disabled={pending || deletionRequested}
            onClick={() => setConfirmDelete(true)}
          >
            {deletionRequested ? "Deletion request pending" : "Request account deletion"}
          </Button>
          {deletionRequested && deletionRequestId ? (
            <Button
              disabled={pending}
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
      {confirmDelete ? (
        <div className="overlay" role="presentation">
          <div
            className="dialog account-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <p className="card-eyebrow">A considered next step</p>
            <h2 id="delete-dialog-title">Request account deletion?</h2>
            <p>
              This queues deletion with a grace period. It is not immediate, and you can cancel while the
              request is pending.
            </p>
            <div className="account-confirm-actions">
              <Button disabled={pending} variant="quiet" onClick={() => setConfirmDelete(false)}>
                Keep my account
              </Button>
              <Button
                disabled={pending}
                variant="secondary"
                onClick={() => {
                  setConfirmDelete(false);
                  action("/api/account/delete", { confirmation: "DELETE" });
                }}
              >
                Confirm deletion
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
