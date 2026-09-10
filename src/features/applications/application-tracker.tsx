"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Badge, Button, EmptyState, FormField, Input, Select, Toast } from "@/components/ui";

const applicationStatuses = [
  "interested",
  "preparing",
  "ready",
  "submitted",
  "assessment",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const;
const documentCategories = [
  "identity",
  "education",
  "employment",
  "language",
  "professional",
  "trade",
  "portfolio",
  "application",
  "other",
] as const;
type ApplicationStatus = (typeof applicationStatuses)[number];
export type Phase9FixtureState =
  "default" | "empty" | "loading" | "success" | "error" | "interrupted" | "permission" | "completed";

const uploadRecoveryKey = "wayfound:document-upload-recovery";

type UploadDraft = {
  category: string;
  documentType: string;
  expiresOn: string;
  idempotencyKey: string;
};

function StateNotice({
  description,
  title,
  tone = "neutral",
}: {
  description: string;
  title: string;
  tone?: "neutral" | "error" | "success" | "warning";
}) {
  return (
    <section className={`phase9-state phase9-state-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span aria-hidden="true" className="phase9-state-icon">
        {tone === "success" ? "✓" : tone === "error" ? "!" : tone === "warning" ? "↻" : "…"}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}

export type DocumentLibraryItem = {
  id: string;
  name: string;
  type: string;
  category: string;
  expiresOn: string | null;
  updatedAt: string;
};
export type ApplicationItem = {
  id: string;
  title: string;
  organization: string;
  status: ApplicationStatus;
  officialDeadline: string | null;
  internalDeadline: string | null;
  checklistDone: number;
  checklistTotal: number;
};

const statusLabel = (value: string) => value.replaceAll("_", " ");

export function CreateApplicationButton({ matchId }: { matchId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const create = async () => {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId, idempotencyKey: crypto.randomUUID() }),
    });
    const body = (await response.json().catch(() => null)) as {
      applicationId?: string;
      error?: string;
    } | null;
    setLoading(false);
    if (!response.ok || !body?.applicationId)
      return setError(body?.error ?? "The workspace could not be created.");
    window.location.assign(`/applications/${body.applicationId}`);
  };
  return (
    <>
      <Button loading={loading} onClick={create} variant="primary">
        Create application workspace
      </Button>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function DocumentLibrary({
  fixtureState = "default",
  initial,
}: {
  fixtureState?: Phase9FixtureState;
  initial: DocumentLibraryItem[];
}) {
  const [documents] = useState(initial);
  const [message, setMessage] = useState<string | null>(
    fixtureState === "success"
      ? "Document saved privately. You can safely leave and return to your library."
      : null,
  );
  const [error, setError] = useState<string | null>(
    fixtureState === "error" ? "The upload could not be completed. Your existing files are unchanged." : null,
  );
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recovery, setRecovery] = useState(fixtureState === "interrupted");
  const [documentType, setDocumentType] = useState("");
  const [category, setCategory] = useState("identity");
  const [expiresOn, setExpiresOn] = useState("");
  const requestRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    if (fixtureState !== "default") return;
    try {
      const stored = sessionStorage.getItem(uploadRecoveryKey);
      if (!stored) return;
      const draft = JSON.parse(stored) as Partial<UploadDraft>;
      if (typeof draft.documentType === "string") setDocumentType(draft.documentType.slice(0, 80));
      if (documentCategories.includes(draft.category as (typeof documentCategories)[number]))
        setCategory(draft.category!);
      if (typeof draft.expiresOn === "string") setExpiresOn(draft.expiresOn);
      setRecovery(true);
    } catch {
      sessionStorage.removeItem(uploadRecoveryKey);
    }
  }, [fixtureState]);

  const sendUpload = (data: FormData) =>
    new Promise<{ ok: boolean; error?: string }>((resolve, reject) => {
      const request = new XMLHttpRequest();
      requestRef.current = request;
      request.open("POST", "/api/documents");
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.max(1, Math.round((event.loaded / event.total) * 100)));
      };
      request.onload = () => {
        let body: { error?: string } = {};
        try {
          body = JSON.parse(request.responseText) as { error?: string };
        } catch {}
        resolve({ ok: request.status >= 200 && request.status < 300, error: body.error });
      };
      request.onerror = () => reject(new Error("interrupted"));
      request.onabort = () => reject(new Error("cancelled"));
      request.send(data);
    });

  const upload = async (form: HTMLFormElement) => {
    setUploading(true);
    setProgress(0);
    setError(null);
    setMessage(null);
    const data = new FormData(form);
    const storedKey = (() => {
      try {
        const prior = JSON.parse(sessionStorage.getItem(uploadRecoveryKey) ?? "{}") as Partial<UploadDraft>;
        return typeof prior.idempotencyKey === "string" ? prior.idempotencyKey : crypto.randomUUID();
      } catch {
        return crypto.randomUUID();
      }
    })();
    data.set("idempotencyKey", storedKey);
    const draft: UploadDraft = { category, documentType, expiresOn, idempotencyKey: storedKey };
    sessionStorage.setItem(uploadRecoveryKey, JSON.stringify(draft));
    try {
      const result = await sendUpload(data);
      if (!result.ok) {
        setRecovery(true);
        return setError(
          result.error ?? "The upload could not be completed. Your existing files are unchanged.",
        );
      }
      sessionStorage.removeItem(uploadRecoveryKey);
      setRecovery(false);
      setProgress(100);
      setMessage("Document saved privately. You can safely leave and return to your library.");
      form.reset();
      setDocumentType("");
      setCategory("identity");
      setExpiresOn("");
    } catch (uploadError) {
      setRecovery(true);
      setError(
        uploadError instanceof Error && uploadError.message === "cancelled"
          ? "Upload cancelled. Choose the file again when you are ready; your details are preserved."
          : "Upload interrupted. Choose the file again to safely retry; your details are preserved.",
      );
    } finally {
      requestRef.current = null;
      setUploading(false);
    }
  };

  if (fixtureState === "permission")
    return (
      <section className="application-surface" aria-labelledby="documents-title">
        <header className="application-hero">
          <p className="eyebrow">PREPARE</p>
          <h1 id="documents-title">Your document library</h1>
        </header>
        <StateNotice
          description="Sign in with the account that owns these private files. No document information has been shown."
          title="Private library unavailable"
          tone="error"
        />
        <Link className="ui-button ui-button-primary" href="/login">
          Sign in securely
        </Link>
      </section>
    );

  if (fixtureState === "loading")
    return (
      <section className="application-surface" aria-busy="true" aria-labelledby="documents-title">
        <header className="application-hero">
          <p className="eyebrow">PREPARE</p>
          <h1 id="documents-title">Your document library</h1>
        </header>
        <StateNotice
          description="Your private document list is loading securely."
          title="Loading your files"
        />
      </section>
    );

  return (
    <section className="application-surface" aria-labelledby="documents-title">
      <header className="application-hero">
        <p className="eyebrow">PREPARE</p>
        <h1 id="documents-title">Your document library</h1>
        <p>Private files stay in your account. Uploading a replacement preserves the earlier version.</p>
      </header>
      <form
        className="document-upload-form"
        onSubmit={(event) => {
          event.preventDefault();
          void upload(event.currentTarget);
        }}
      >
        <FormField label="Document">
          <Input accept=".pdf,.docx,.jpg,.jpeg,.png" capture="environment" name="file" required type="file" />
        </FormField>
        <FormField label="Document type">
          <Input
            maxLength={80}
            name="documentType"
            onChange={(event) => setDocumentType(event.target.value)}
            placeholder="Passport, transcript or CV"
            required
            value={documentType}
          />
        </FormField>
        <FormField label="Category">
          <Select name="category" onChange={(event) => setCategory(event.target.value)} value={category}>
            {documentCategories.map((category) => (
              <option key={category} value={category}>
                {statusLabel(category)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          hint="Optional. This helps you review preparation dates; it does not verify a document."
          label="Expiry date"
        >
          <Input
            name="expiresOn"
            onChange={(event) => setExpiresOn(event.target.value)}
            type="date"
            value={expiresOn}
          />
        </FormField>
        <Button loading={uploading} type="submit" variant="teal">
          Upload private document
        </Button>
        {uploading ? (
          <div aria-live="polite" className="upload-progress" role="status">
            <progress aria-label="Document upload progress" max="100" value={progress} />
            <span>{progress ? `${progress}% uploaded` : "Preparing secure upload…"}</span>
            <Button onClick={() => requestRef.current?.abort()} type="button" variant="secondary">
              Cancel upload
            </Button>
          </div>
        ) : null}
        <p className="upload-hint">PDF, DOCX, JPG or PNG · up to 10 MB · camera supported on mobile.</p>
      </form>
      {recovery ? (
        <StateNotice
          description="Your document details are preserved, but the private file is not. Choose it again to retry safely."
          title="Upload recovery available"
          tone="warning"
        />
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <section aria-labelledby="library-list-title">
        <h2 id="library-list-title">Your files</h2>
        {documents.length ? (
          <div className="document-list">
            {documents.map((document) => (
              <article className="document-row" key={document.id}>
                <div>
                  <strong>{document.name}</strong>
                  <p>
                    {document.type} · {statusLabel(document.category)} · Updated{" "}
                    {new Date(document.updatedAt).toLocaleDateString()}
                  </p>
                  {document.expiresOn ? <p>Review by {document.expiresOn}</p> : null}
                </div>
                <Badge tone="teal">Private</Badge>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No documents yet"
            description="Upload a document when you are ready. Nothing is shared publicly."
          />
        )}
      </section>
      {message ? <Toast message={message} onClose={() => setMessage(null)} /> : null}
    </section>
  );
}

export function ApplicationTracker({
  fixtureState = "default",
  initial,
}: {
  fixtureState?: Phase9FixtureState;
  initial: ApplicationItem[];
}) {
  const [applications, setApplications] = useState(initial);
  const [error, setError] = useState<string | null>(
    fixtureState === "error"
      ? "Your application workspaces could not be loaded. Nothing was changed. Try again shortly."
      : null,
  );
  const transition = async (application: ApplicationItem, status: ApplicationStatus) => {
    setError(null);
    const response = await fetch(`/api/applications/${application.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, note: "", idempotencyKey: crypto.randomUUID() }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) return setError(body?.error ?? "The status could not be updated.");
    setApplications((items) =>
      items.map((item) => (item.id === application.id ? { ...item, status } : item)),
    );
  };

  if (fixtureState === "permission")
    return (
      <section className="application-surface" aria-labelledby="applications-title">
        <header className="application-hero">
          <p className="eyebrow">MY APPLICATIONS</p>
          <h1 id="applications-title">Move from match to momentum.</h1>
        </header>
        <StateNotice
          description="Sign in with the account that owns these workspaces. No application information has been shown."
          title="Private applications unavailable"
          tone="error"
        />
        <Link className="ui-button ui-button-primary" href="/login">
          Sign in securely
        </Link>
      </section>
    );

  if (fixtureState === "loading")
    return (
      <section className="application-surface" aria-busy="true" aria-labelledby="applications-title">
        <header className="application-hero">
          <p className="eyebrow">MY APPLICATIONS</p>
          <h1 id="applications-title">Move from match to momentum.</h1>
        </header>
        <StateNotice
          description="Your private application workspaces are loading."
          title="Loading applications"
        />
      </section>
    );
  return (
    <section className="application-surface" aria-labelledby="applications-title">
      <header className="application-hero">
        <p className="eyebrow">MY APPLICATIONS</p>
        <h1 id="applications-title">Move from match to momentum.</h1>
        <p>Track your own preparation. A workspace does not submit an application for you.</p>
      </header>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {applications.length ? (
        <div className="application-list">
          {applications.map((application) => (
            <article className="application-card" key={application.id}>
              <div>
                <Badge tone={application.status === "submitted" ? "teal" : "amber"}>
                  {statusLabel(application.status)}
                </Badge>
                <h2>{application.title}</h2>
                <p>{application.organization}</p>
              </div>
              <dl>
                <div>
                  <dt>Checklist</dt>
                  <dd>
                    {application.checklistDone}/{application.checklistTotal} complete
                  </dd>
                </div>
                <div>
                  <dt>Official deadline</dt>
                  <dd>{application.officialDeadline ?? "Not stated"}</dd>
                </div>
                <div>
                  <dt>Your preparation date</dt>
                  <dd>{application.internalDeadline ?? "Not set"}</dd>
                </div>
              </dl>
              <label>
                Update status
                <Select
                  aria-label={`Update status for ${application.title}`}
                  onChange={(event) => void transition(application, event.target.value as ApplicationStatus)}
                  value={application.status}
                >
                  {applicationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </Select>
              </label>
              <Link
                className="ui-button ui-button-secondary"
                href={`/applications/${application.id}` as Route}
              >
                Open workspace
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No application workspaces yet"
          description="Create one from a safe opportunity match when you are ready to prepare."
        />
      )}
    </section>
  );
}

export type ApplicationWorkspaceItem = {
  application: ApplicationItem;
  checklist: Array<{ id: string; title: string; state: string; completed: boolean }>;
  notes: Array<{ id: string; body: string; createdAt: string }>;
  reminders: Array<{ id: string; message: string; reminderAt: string; status: string }>;
  history: Array<{ id: string; from: string | null; to: string; note: string; createdAt: string }>;
};

export function ApplicationWorkspace({ initial }: { initial: ApplicationWorkspaceItem }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const post = async (path: string, body: unknown) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "That update could not be saved.");
      return false;
    }
    return true;
  };
  return (
    <section className="application-surface" aria-labelledby="workspace-title">
      <header className="application-hero">
        <p className="eyebrow">APPLICATION WORKSPACE</p>
        <h1 id="workspace-title">{data.application.title}</h1>
        <p>This private workspace helps you prepare. It never submits an application for you.</p>
        <div className="application-hero-actions">
          <Link href="/applications">Back to applications</Link>
          <Link className="ui-button ui-button-teal" href={"/prepare/assistant" as Route}>
            Open CV &amp; writing assistant
          </Link>
        </div>
      </header>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="workspace-grid">
        <article className="application-card">
          <h2>Requirements</h2>
          {data.checklist.length ? (
            <ul className="checklist">
              {data.checklist.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      checked={item.completed}
                      onChange={async (event) => {
                        if (
                          await post(`/api/applications/${data.application.id}/checklist/${item.id}`, {
                            completed: event.target.checked,
                          })
                        )
                          setData((current) => ({
                            ...current,
                            checklist: current.checklist.map((value) =>
                              value.id === item.id ? { ...value, completed: event.target.checked } : value,
                            ),
                          }));
                      }}
                      type="checkbox"
                    />{" "}
                    <span>
                      {item.title} <small>{item.state}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p>No stated requirements are available yet.</p>
          )}
        </article>
        <article className="application-card">
          <h2>Preparation reminder</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void (async () => {
                const reminderAt = String(form.get("reminderAt"));
                const message = String(form.get("message"));
                if (
                  await post(`/api/applications/${data.application.id}/reminders`, {
                    reminderAt: new Date(reminderAt).toISOString(),
                    message,
                  })
                ) {
                  event.currentTarget.reset();
                  window.location.reload();
                }
              })();
            }}
          >
            <Input name="reminderAt" required type="datetime-local" />
            <Input maxLength={240} name="message" placeholder="Review documents" required />
            <Button type="submit" variant="secondary">
              Save reminder
            </Button>
          </form>
          {data.reminders.map((item) => (
            <p key={item.id}>
              {new Date(item.reminderAt).toLocaleString()} · {item.message}
            </p>
          ))}
        </article>
        <article className="application-card">
          <h2>Private notes</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void (async () => {
                const body = String(form.get("body"));
                if (await post(`/api/applications/${data.application.id}/notes`, { body })) {
                  event.currentTarget.reset();
                  window.location.reload();
                }
              })();
            }}
          >
            <textarea aria-label="Private application note" maxLength={8000} name="body" required />
            <Button type="submit" variant="secondary">
              Save note
            </Button>
          </form>
          {data.notes.map((item) => (
            <p key={item.id}>{item.body}</p>
          ))}
        </article>
        <article className="application-card">
          <h2>Status history</h2>
          {data.history.map((item) => (
            <p key={item.id}>
              {item.from ? `${statusLabel(item.from)} to ` : "Started as "}
              {statusLabel(item.to)} · {new Date(item.createdAt).toLocaleDateString()}
            </p>
          ))}
        </article>
      </section>
    </section>
  );
}
