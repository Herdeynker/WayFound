"use client";

import { useState } from "react";
import { Button, Checkbox } from "@/components/ui";

const choices = [
  ["profile_matching", "Use my profile to match me with relevant opportunities.", true],
  ["ai_processing", "Allow assisted processing to organize and explain my information.", true],
  ["document_storage", "Store documents I choose to upload in my private account.", true],
  ["email_notifications", "Send me helpful opportunity and deadline alerts by email.", false],
  ["telegram_notifications", "Telegram alerts (available after a later account-linking update).", false],
] as const;

export function ConsentForm() {
  const [values, setValues] = useState({
    profile_matching: false,
    ai_processing: false,
    document_storage: false,
    email_notifications: false,
    telegram_notifications: false,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error ?? "Please review your required choices.");
    else window.location.assign(data.redirectTo ?? "/dashboard");
    setPending(false);
  }
  return (
    <form className="consent-form" onSubmit={submit}>
      <div className="consent-list">
        {choices.map(([key, label, required]) => (
          <Checkbox
            key={key}
            checked={values[key]}
            disabled={key === "telegram_notifications"}
            label={`${label}${required ? " (required)" : ""}`}
            onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.checked }))}
          />
        ))}
      </div>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button loading={pending} type="submit">
        Save choices <span aria-hidden="true">→</span>
      </Button>
      <p className="consent-footnote">
        You can change optional alert preferences later. Earlier consent decisions remain recorded as a
        versioned history.
      </p>
    </form>
  );
}
