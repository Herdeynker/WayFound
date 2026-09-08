"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

type AuthMode = "login" | "register";

async function send(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    redirectTo?: string;
  };
  if (!response.ok) throw new Error(data.error ?? "We could not complete that request.");
  return data;
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [magic, setMagic] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      const data = await send(
        `/api/auth/${magic ? "magic-link" : mode}`,
        magic ? { email } : { email, password, firstName },
      );
      if (data.redirectTo) window.location.assign(data.redirectTo);
      else setMessage(data.message ?? "Check your inbox for the next step.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not complete that request.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-card-heading">
        <p className="card-eyebrow">{mode === "login" ? "Welcome back" : "Start your journey"}</p>
        <h2>{mode === "login" ? "Sign in to WAYFOUND" : "Create your account"}</h2>
        <p>
          {mode === "login"
            ? "Pick up where your opportunity story left off."
            : "A stronger path starts with a few simple details."}
        </p>
      </div>
      <div className="auth-methods" role="tablist" aria-label="Sign-in methods">
        <button
          className={!magic ? "is-active" : ""}
          onClick={() => setMagic(false)}
          role="tab"
          type="button"
          aria-selected={!magic}
        >
          Password
        </button>
        <button
          className={magic ? "is-active" : ""}
          onClick={() => setMagic(true)}
          role="tab"
          type="button"
          aria-selected={magic}
        >
          Magic link
        </button>
      </div>
      <form onSubmit={submit} className="auth-form">
        {mode === "register" && !magic ? (
          <label>
            First name
            <Input
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </label>
        ) : null}
        <label>
          Email address
          <Input
            autoComplete="email"
            inputMode="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        {!magic ? (
          <label>
            Password
            <Input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <small>Use at least 8 characters.</small>
          </label>
        ) : null}
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="auth-success" role="status">
            {message}
          </p>
        ) : null}
        <Button className="auth-submit" loading={pending} type="submit">
          {magic ? "Send magic link" : mode === "login" ? "Sign in" : "Create account"}{" "}
          <span aria-hidden="true">→</span>
        </Button>
      </form>
      {mode === "login" && !magic ? (
        <a className="auth-inline-link" href="/forgot-password">
          Forgot your password?
        </a>
      ) : null}
      <div className="auth-divider">
        <span>or</span>
      </div>
      {process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true" ? (
        <a className="google-button" href="/api/auth/oauth">
          Continue with Google
        </a>
      ) : (
        <button
          className="google-button is-disabled"
          disabled
          title="Google sign-in is not enabled for this environment"
          type="button"
        >
          Google sign-in unavailable
        </button>
      )}
      <p className="auth-switch">
        {mode === "login" ? "New to WAYFOUND?" : "Already have an account?"}{" "}
        <a href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </a>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const data = await send("/api/auth/forgot-password", { email });
      setMessage(data.message ?? "Check your inbox.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="auth-card">
      <div className="auth-card-heading">
        <p className="card-eyebrow">Recover access</p>
        <h2>Reset your password</h2>
        <p>Enter your email and we’ll send a secure recovery link if an account exists.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Email address
          <Input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="auth-success" role="status">
            {message}
          </p>
        ) : null}
        <Button className="auth-submit" loading={pending} type="submit">
          Send recovery link <span aria-hidden="true">→</span>
        </Button>
      </form>
      <p className="auth-switch">
        <a href="/login">Return to sign in</a>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const data = await send("/api/auth/reset-password", { password });
      window.location.assign(data.redirectTo ?? "/login?reset=success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This recovery link is invalid or expired.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="auth-card">
      <div className="auth-card-heading">
        <p className="card-eyebrow">New direction</p>
        <h2>Choose a new password</h2>
        <p>Use a password you can keep private and remember.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <label>
          New password
          <Input
            autoComplete="new-password"
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label>
          Confirm new password
          <Input
            autoComplete="new-password"
            minLength={8}
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </label>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="auth-submit" loading={pending} type="submit">
          Save new password <span aria-hidden="true">→</span>
        </Button>
      </form>
    </div>
  );
}
