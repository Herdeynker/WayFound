"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, EmptyState, FormField, Input, Select } from "@/components/ui";
import { draftKinds, draftTones, type AssistantSourceFact } from "./types";

export type AssistantSummary = {
  drafts: Array<{
    id: string;
    title: string;
    kind: string;
    status: string;
    updatedAt: string;
    revisionId: string;
    approvedRevisionId: string;
  }>;
  analyses: Array<{ id: string; alignmentScore: number; createdAt: string }>;
};

export type AssistantState =
  | "default"
  | "loading"
  | "empty"
  | "success"
  | "error"
  | "interrupted"
  | "stale"
  | "permission"
  | "disabled"
  | "completed";

const labels: Record<string, string> = {
  tailored_cv: "Tailored CV",
  cover_letter: "Cover letter",
  motivation_letter: "Motivation letter",
  personal_statement: "Personal statement",
  essay: "Essay",
  study_plan: "Study plan",
  impact_statement: "Impact statement",
  recruiter_message: "Recruiter message",
};

function StatePanel({ state }: { state: AssistantState }) {
  const stateCopy: Partial<Record<AssistantState, readonly [string, string]>> = {
    loading: ["Loading your private workspace", "Your analyses and drafts are being retrieved securely."],
    error: [
      "Workspace unavailable",
      "Your saved work is unchanged. Try again when your connection is stable.",
    ],
    interrupted: [
      "Generation was interrupted",
      "Your approved facts are saved. Retry with the same request when you are ready.",
    ],
    stale: [
      "Draft needs review",
      "The source facts changed after this draft was created. Review and approve the current facts before generating a new revision.",
    ],
    permission: [
      "Private assistant unavailable",
      "Sign in with the account that owns this application. No private facts were shown.",
    ],
    disabled: [
      "Writing provider not configured",
      "You can review facts and save your setup. Generation will remain honestly unavailable until a server-only provider is configured.",
    ],
  };
  const copy = stateCopy[state];
  if (!copy) return null;
  return (
    <section
      className={`assistant-state assistant-state-${state}`}
      role={state === "error" || state === "permission" ? "alert" : "status"}
    >
      <span aria-hidden="true">{state === "loading" ? "…" : state === "interrupted" ? "↻" : "!"}</span>
      <div>
        <h2>{copy[0]}</h2>
        <p>{copy[1]}</p>
      </div>
    </section>
  );
}

export function AssistantWorkspace({
  applications,
  fixture = false,
  initial,
  sourceFacts,
  state = "default",
}: {
  applications: Array<{ id: string; title: string }>;
  fixture?: boolean;
  initial: AssistantSummary;
  sourceFacts: AssistantSourceFact[];
  state?: AssistantState;
}) {
  const [tab, setTab] = useState<"analyse" | "write">("write");
  const [summary] = useState(initial);
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [cvText, setCvText] = useState("");
  const [analysis, setAnalysis] = useState<{
    alignmentScore: number;
    findings: Array<{ kind: string; section: string; summary: string }>;
  } | null>(
    state === "success"
      ? {
          alignmentScore: 72,
          findings: [
            {
              kind: "weak",
              section: "experience",
              summary: "Strengthen evidence-based bullets without adding unsupported metrics.",
            },
          ],
        }
      : null,
  );
  const [kind, setKind] = useState("motivation_letter");
  const [tone, setTone] = useState("clear");
  const [wordLimit, setWordLimit] = useState(500);
  const [facts, setFacts] = useState(sourceFacts);
  const [factsApproved, setFactsApproved] = useState(sourceFacts.map(() => fixture));
  const [newFactLabel, setNewFactLabel] = useState("");
  const [newFactValue, setNewFactValue] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(
    state === "error" ? "The request could not be completed." : null,
  );
  const [draft, setDraft] = useState<{
    id: string;
    revisionId: string;
    content: string;
    approved: boolean;
  } | null>(
    state === "completed" || state === "success"
      ? {
          id: initial.drafts[0]?.id ?? "22222222-2222-4222-8222-222222222222",
          revisionId: initial.drafts[0]?.revisionId ?? "33333333-3333-4333-8333-333333333333",
          content:
            "Motivation letter for Global Technology Scholarship\n\nConfirmed qualification: BSc Computer Science\n\nRelevant experience: Built and maintained accessible web applications",
          approved: state === "completed",
        }
      : null,
  );
  const contextualFacts = useMemo(() => {
    const selectedTitle = applications.find((application) => application.id === applicationId)?.title;
    return facts.map((fact) =>
      fact.category === "opportunity" && fact.label === "Selected opportunity" && selectedTitle
        ? { ...fact, value: selectedTitle }
        : fact,
    );
  }, [applicationId, applications, facts]);
  const approvedFacts = useMemo(
    () => contextualFacts.filter((_, index) => factsApproved[index]),
    [contextualFacts, factsApproved],
  );

  const addEvidenceFact = () => {
    const label = newFactLabel.trim();
    const value = newFactValue.trim();
    if (!label || !value) return;
    setFacts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        category: "user_evidence",
        label,
        value,
        evidenceLabel: "User-provided evidence",
        approved: true,
      },
    ]);
    setFactsApproved((current) => [...current, true]);
    setNewFactLabel("");
    setNewFactValue("");
  };

  if (state === "permission")
    return (
      <main className="assistant-page">
        <StatePanel state={state} />
        <Link className="ui-button ui-button-primary" href="/login">
          Sign in securely
        </Link>
      </main>
    );
  if (state === "loading")
    return (
      <main aria-busy="true" className="assistant-page">
        <StatePanel state={state} />
      </main>
    );

  const analyse = async () => {
    setWorking(true);
    setError(null);
    if (fixture) {
      setAnalysis({
        alignmentScore: 72,
        findings: [
          {
            kind: "missing",
            section: "skills",
            summary: "Add a clear skills section using confirmed facts.",
          },
          {
            kind: "weak",
            section: "experience",
            summary: "Use concise evidence-based bullet points; do not add unsupported metrics.",
          },
        ],
      });
      setWorking(false);
      return;
    }
    const response = await fetch("/api/assistant/analyse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId, idempotencyKey: crypto.randomUUID(), text: cvText }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      alignmentScore?: number;
      findings?: Array<{ kind: string; section: string; summary: string }>;
    } | null;
    setWorking(false);
    if (!response.ok || body?.alignmentScore === undefined)
      return setError(body?.error ?? "The CV could not be analysed.");
    setAnalysis({ alignmentScore: body.alignmentScore, findings: body.findings ?? [] });
  };

  const generate = async () => {
    setWorking(true);
    setError(null);
    const idempotencyKey = crypto.randomUUID();
    if (fixture) {
      setDraft({
        id: "22222222-2222-4222-8222-222222222222",
        revisionId: "33333333-3333-4333-8333-333333333333",
        content: `${labels[kind]} for ${applications[0]?.title}\n\n${approvedFacts.map((fact) => `${fact.label}: ${fact.value}`).join("\n\n")}`,
        approved: false,
      });
      setWorking(false);
      return;
    }
    const response = await fetch("/api/assistant/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId,
        idempotencyKey,
        kind,
        title: `${labels[kind]} for selected opportunity`,
        tone,
        wordLimit,
        facts: approvedFacts,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      draftId?: string;
      revisionId?: string;
      content?: string;
    } | null;
    setWorking(false);
    if (!response.ok || !body?.draftId || !body.revisionId || !body.content)
      return setError(body?.error ?? "The draft could not be generated.");
    setDraft({ id: body.draftId, revisionId: body.revisionId, content: body.content, approved: false });
  };

  const approve = async () => {
    if (!draft) return;
    if (fixture) return setDraft({ ...draft, approved: true });
    setWorking(true);
    const response = await fetch(`/api/assistant/drafts/${draft.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revisionId: draft.revisionId }),
    });
    setWorking(false);
    if (!response.ok) return setError("This draft revision could not be approved.");
    setDraft({ ...draft, approved: true });
  };

  return (
    <main className="assistant-page">
      <header className="assistant-hero">
        <div>
          <p className="eyebrow">PREPARE · APPLICATION ASSISTANT</p>
          <h1>Turn your facts into a stronger application.</h1>
          <p>
            Review your CV, approve every source fact, then create truthful opportunity-specific materials.
            WAYFOUND never submits for you.
          </p>
        </div>
        <div className="assistant-trust">
          <strong>Facts first</strong>
          <span>No invented achievements</span>
          <span>Private and reviewable</span>
        </div>
      </header>
      <nav aria-label="Assistant tools" className="assistant-tabs">
        <button
          aria-current={tab === "analyse" ? "page" : undefined}
          onClick={() => setTab("analyse")}
          type="button"
        >
          CV review
        </button>
        <button
          aria-current={tab === "write" ? "page" : undefined}
          onClick={() => setTab("write")}
          type="button"
        >
          Writing studio
        </button>
      </nav>
      {state === "disabled" || state === "interrupted" || state === "stale" ? (
        <StatePanel state={state} />
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {!applications.length || state === "empty" ? (
        <EmptyState
          title="Start an application first"
          description="Create a private application workspace from an opportunity before using the assistant."
        />
      ) : tab === "analyse" ? (
        <section className="assistant-grid" aria-labelledby="cv-review-title">
          <article className="assistant-card">
            <p className="eyebrow">CV INTELLIGENCE</p>
            <h2 id="cv-review-title">Review against confirmed facts</h2>
            <FormField label="Application">
              <Select value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.title}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="CV text"
              hint="Used for this analysis only. Raw CV text is not saved in analysis records or logs."
            >
              <textarea
                minLength={200}
                maxLength={50000}
                onChange={(event) => setCvText(event.target.value)}
                placeholder="Paste the text from your CV…"
                value={cvText}
              />
            </FormField>
            <Button
              disabled={cvText.trim().length < 200}
              loading={working}
              onClick={() => void analyse()}
              variant="teal"
            >
              Analyse this CV
            </Button>
          </article>
          <article className="assistant-card assistant-result">
            <p className="eyebrow">ROLE ALIGNMENT</p>
            {analysis ? (
              <>
                <div className="alignment-score">
                  <strong>{analysis.alignmentScore}%</strong>
                  <span>CV alignment — not an outcome probability</span>
                </div>
                <p className="assistant-guidance">
                  No Passport field will be changed. Review each difference and update your confirmed profile
                  separately if needed.
                </p>
                <ul>
                  {analysis.findings.map((finding, index) => (
                    <li key={`${finding.section}-${index}`}>
                      <Badge tone={finding.kind === "aligned" ? "teal" : "amber"}>{finding.kind}</Badge>
                      <div>
                        <strong>{finding.section}</strong>
                        <p>{finding.summary}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState
                title="No review yet"
                description="Paste your CV text to see missing, inconsistent and weak sections. No Passport field will be changed."
              />
            )}
          </article>
        </section>
      ) : (
        <section className="assistant-grid" aria-labelledby="writing-title">
          <article className="assistant-card">
            <p className="eyebrow">EVIDENCE CHECK</p>
            <h2 id="writing-title">Approve facts before drafting</h2>
            <FormField label="Application">
              <Select value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.title}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="assistant-fields">
              <FormField label="Material">
                <Select value={kind} onChange={(event) => setKind(event.target.value)}>
                  {draftKinds.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Tone">
                <Select value={tone} onChange={(event) => setTone(event.target.value)}>
                  {draftTones.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Word limit">
                <Input
                  min={50}
                  max={2000}
                  type="number"
                  value={wordLimit}
                  onChange={(event) => setWordLimit(Number(event.target.value))}
                />
              </FormField>
            </div>
            <fieldset className="fact-list">
              <legend>Approved source facts</legend>
              {contextualFacts.map((fact, index) => (
                <label key={fact.id}>
                  <input
                    checked={factsApproved[index]}
                    onChange={(event) =>
                      setFactsApproved((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? event.target.checked : value,
                        ),
                      )
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>{fact.label}</strong>
                    <small>{fact.evidenceLabel}</small>
                    <span>{fact.value}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <section className="assistant-evidence-question" aria-labelledby="evidence-question-title">
              <div>
                <strong id="evidence-question-title">
                  What achievement or experience should this draft use?
                </strong>
                <span>Only add something you can personally verify. Metrics are never invented.</span>
              </div>
              <FormField label="Evidence fact label">
                <Input
                  maxLength={120}
                  onChange={(event) => setNewFactLabel(event.target.value)}
                  placeholder="For example: Community leadership"
                  value={newFactLabel}
                />
              </FormField>
              <FormField label="Evidence fact value">
                <Input
                  maxLength={1200}
                  onChange={(event) => setNewFactValue(event.target.value)}
                  placeholder="State the verified evidence in your own words"
                  value={newFactValue}
                />
              </FormField>
              <Button disabled={!newFactLabel.trim() || !newFactValue.trim()} onClick={addEvidenceFact}>
                Add evidence fact
              </Button>
            </section>
            <p className="assistant-guidance">
              <strong>Format guidance · General practice</strong>
              <br />
              Use concise, reverse-chronological evidence where it suits the destination and occupation.
              Confirm factual country-specific rules on the selected opportunity’s official source; this is
              writing guidance, not legal advice.
            </p>
            <Button
              disabled={approvedFacts.length === 0 || state === "disabled"}
              loading={working}
              onClick={() => void generate()}
              variant="teal"
            >
              Create grounded draft
            </Button>
          </article>
          <article className="assistant-card assistant-result">
            <p className="eyebrow">YOUR DRAFT</p>
            {draft ? (
              <>
                <h2>{labels[kind]}</h2>
                <pre className="draft-preview">{draft.content}</pre>
                <p className="draft-check">
                  ✓ Every paragraph is linked to approved facts. Review the wording before use.
                </p>
                <div className="draft-actions">
                  <Button
                    loading={working}
                    onClick={() => void approve()}
                    variant={draft.approved ? "secondary" : "primary"}
                  >
                    {draft.approved ? "Approved" : "Approve this revision"}
                  </Button>
                  {draft.approved ? (
                    <>
                      <a
                        className="ui-button ui-button-secondary"
                        href={`/api/assistant/drafts/${draft.id}/export?format=pdf`}
                      >
                        Export PDF
                      </a>
                      <a
                        className="ui-button ui-button-secondary"
                        href={`/api/assistant/drafts/${draft.id}/export?format=docx`}
                      >
                        Export DOCX
                      </a>
                    </>
                  ) : null}
                </div>
              </>
            ) : (
              <EmptyState
                title="No draft yet"
                description="Approve at least one fact. Generation is opportunity-specific and will stop if grounding cannot be verified."
              />
            )}
          </article>
        </section>
      )}
      {summary.drafts.length ? (
        <section className="assistant-history" aria-labelledby="draft-history-title">
          <div>
            <p className="eyebrow">SAVE & RESUME</p>
            <h2 id="draft-history-title">Your recent drafts</h2>
          </div>
          {summary.drafts.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {labels[item.kind] ?? item.kind} · {item.status} ·{" "}
                  {new Date(item.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <Badge tone={item.status === "approved" ? "teal" : "amber"}>{item.status}</Badge>
            </article>
          ))}
        </section>
      ) : null}
      <p className="assistant-boundary">
        AI drafts are suggestions, not legal or immigration advice. You remain responsible for review,
        declarations and final submission.
      </p>
    </main>
  );
}
