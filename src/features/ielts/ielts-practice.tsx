"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, EmptyState, FormField, Input, Select, Skeleton } from "@/components/ui";
import {
  countWords,
  readingContentSchema,
  remainingSeconds,
  speakingContentSchema,
  writingContentSchema,
} from "./model";
import type { IeltsContentView, IeltsOverview, IeltsProfileView, IeltsViewState } from "./types";

type Tool = "overview" | "reading" | "writing" | "speaking";
type ReadingResult = { score: number; maximum: number; estimatedBand: number };
const timerKey = "wayfound:ielts-reading-timer";
const recordingRecoveryKey = "wayfound:ielts-recording-recovery";

function Notice({
  title,
  copy,
  tone = "neutral",
}: {
  title: string;
  copy: string;
  tone?: "neutral" | "error" | "warning" | "success";
}) {
  return (
    <section className={`ielts-notice ielts-notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span aria-hidden="true">
        {tone === "success" ? "✓" : tone === "error" ? "!" : tone === "warning" ? "↻" : "i"}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
    </section>
  );
}

export function IeltsPractice({
  overview,
  state = "default",
  fixture = false,
}: {
  overview: IeltsOverview;
  state?: IeltsViewState;
  fixture?: boolean;
}) {
  const [tool, setTool] = useState<Tool>("overview");
  const [profile, setProfile] = useState(overview.profile);
  const [message, setMessage] = useState(
    state === "success" ? "Your IELTS practice progress was saved." : "",
  );
  const relevantContent = useMemo(
    () =>
      overview.content.filter(
        (item) => !profile || item.testType === "both" || item.testType === profile.testType,
      ),
    [overview.content, profile],
  );
  const reading =
    relevantContent.find((item) => item.skill === "reading" && item.activityKind === "diagnostic") ??
    relevantContent.find((item) => item.skill === "reading");
  const writing = relevantContent.find((item) => item.skill === "writing");
  const speaking = relevantContent.find((item) => item.skill === "speaking");

  if (state === "permission")
    return (
      <main className="ielts-surface">
        <header className="ielts-hero">
          <p className="eyebrow">PREPARE · IELTS</p>
          <h1>Your private practice space</h1>
        </header>
        <Notice
          title="Practice history unavailable"
          copy="Sign in with the account that owns this IELTS history. No private response, transcript or recording was shown."
          tone="error"
        />
        <Link className="ui-button ui-button-primary" href="/login">
          Sign in securely
        </Link>
      </main>
    );
  if (state === "loading")
    return (
      <main className="ielts-surface" aria-busy="true">
        <header className="ielts-hero">
          <p className="eyebrow">PREPARE · IELTS</p>
          <h1>Your IELTS preparation path</h1>
        </header>
        <div className="ielts-loading-grid">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </main>
    );

  return (
    <main className="ielts-surface" data-state={state}>
      <header className="ielts-hero">
        <div>
          <p className="eyebrow">PREPARE · IELTS</p>
          <h1>Practice with a clearer route.</h1>
          <p>Original, governed tasks that turn your next practice result into a practical study step.</p>
        </div>
        <div className="ielts-unofficial">
          <strong>Unofficial practice estimates</strong>
          <span>
            WAYFOUND is not affiliated with or endorsed by the IELTS test owners. Verify test information
            through official resources.
          </span>
        </div>
      </header>
      <nav className="ielts-tools" aria-label="IELTS practice tools">
        {(["overview", "reading", "writing", "speaking"] as Tool[]).map((item) => (
          <button
            aria-current={tool === item ? "page" : undefined}
            className={tool === item ? "is-active" : ""}
            key={item}
            onClick={() => setTool(item)}
            type="button"
          >
            {item === "overview" ? "My plan" : item}
          </button>
        ))}
      </nav>
      {state === "error" ? (
        <Notice
          title="Practice could not load"
          copy="Your saved attempts are unchanged. Check your connection and retry."
          tone="error"
        />
      ) : null}
      {state === "interrupted" ? (
        <Notice
          title="Practice was interrupted"
          copy="Your elapsed time and setup were preserved. Resume when your connection is stable."
          tone="warning"
        />
      ) : null}
      {state === "stale" ? (
        <Notice
          title="Your plan needs a refresh"
          copy="A newer completed attempt is available. Refresh before following this recommendation."
          tone="warning"
        />
      ) : null}
      {state === "completed" ? (
        <Notice
          title="Diagnostic complete"
          copy="Your result is an unofficial estimate. Your next study steps are ready below."
          tone="success"
        />
      ) : null}
      {message ? (
        <p className="ielts-inline-message" role="status">
          {message}
        </p>
      ) : null}
      {tool === "overview" ? (
        <OverviewPanel
          fixture={fixture}
          overview={overview}
          profile={profile}
          setMessage={setMessage}
          setProfile={setProfile}
          setTool={setTool}
        />
      ) : null}
      {tool === "reading" ? (
        reading ? (
          <ReadingPanel content={reading} fixture={fixture} initialInterrupted={state === "interrupted"} />
        ) : (
          <EmptyState
            title="No approved reading task"
            description="Only original or licensed content with approved provenance can appear here."
          />
        )
      ) : null}
      {tool === "writing" ? (
        writing ? (
          <WritingPanel
            content={writing}
            fixture={fixture}
            providerConfigured={overview.providerConfigured}
          />
        ) : (
          <EmptyState
            title="No approved writing task"
            description="No unapproved content is shown as active practice."
          />
        )
      ) : null}
      {tool === "speaking" ? (
        speaking ? (
          <SpeakingPanel
            content={speaking}
            fixture={fixture}
            profile={profile}
            providerConfigured={overview.providerConfigured}
          />
        ) : (
          <EmptyState
            title="No approved speaking task"
            description="No unapproved content is shown as active practice."
          />
        )
      ) : null}
    </main>
  );
}

function OverviewPanel({
  fixture,
  overview,
  profile,
  setMessage,
  setProfile,
  setTool,
}: {
  fixture: boolean;
  overview: IeltsOverview;
  profile: IeltsProfileView | null;
  setMessage: (value: string) => void;
  setProfile: (value: IeltsProfileView) => void;
  setTool: (value: Tool) => void;
}) {
  const [saving, setSaving] = useState(false);
  const save = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const next: IeltsProfileView = {
      testType: data.get("testType") === "general" ? "general" : "academic",
      targetBand: Number(data.get("targetBand")),
      testDate: String(data.get("testDate") || "") || null,
      recordingRetentionDays: Number(data.get("recordingRetentionDays")),
    };
    setSaving(true);
    if (!fixture) {
      const response = await fetch("/api/ielts/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(body?.error ?? "Your IELTS setup could not be saved.");
        setSaving(false);
        return;
      }
    }
    setProfile(next);
    setMessage("Your IELTS route is saved. You can change it at any time.");
    setSaving(false);
  };
  return (
    <div className="ielts-overview-grid">
      <section className="ielts-setup-card" aria-labelledby="ielts-setup-title">
        <p className="eyebrow">YOUR ROUTE</p>
        <h2 id="ielts-setup-title">{profile ? "Update your IELTS goal" : "Set your IELTS goal"}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save(event.currentTarget);
          }}
        >
          <FormField label="Test type">
            <Select defaultValue={profile?.testType ?? "academic"} name="testType">
              <option value="academic">Academic</option>
              <option value="general">General Training</option>
            </Select>
          </FormField>
          <FormField hint="Choose a personal target, not an eligibility promise." label="Target band">
            <Select defaultValue={String(profile?.targetBand ?? 6.5)} name="targetBand">
              {Array.from({ length: 11 }, (_, index) => 4 + index * 0.5).map((band) => (
                <option key={band} value={band}>
                  {band.toFixed(1)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Planned test date">
            <Input
              defaultValue={profile?.testDate ?? ""}
              min={new Date().toISOString().slice(0, 10)}
              name="testDate"
              type="date"
            />
          </FormField>
          <FormField
            hint="Recordings are private and scheduled for deletion after this period."
            label="Recording retention"
          >
            <Select
              defaultValue={String(profile?.recordingRetentionDays ?? 30)}
              name="recordingRetentionDays"
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </Select>
          </FormField>
          <Button loading={saving} type="submit" variant="teal">
            Save IELTS goal
          </Button>
        </form>
      </section>
      <section className="ielts-plan-card">
        <p className="eyebrow">NEXT STUDY ROUTE</p>
        <h2>{overview.studyPlan?.headline ?? "Start with a short diagnostic."}</h2>
        {overview.studyPlan ? (
          <>
            <p>
              <strong>{overview.studyPlan.minutesPerDay} minutes a day</strong> · Focus on{" "}
              {overview.studyPlan.weakAreas.join(", ")}.
            </p>
            <ol>
              {overview.studyPlan.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        ) : (
          <p>
            Your deterministic reading result will create a first study recommendation. Writing and speaking
            estimates become available after you submit those tasks.
          </p>
        )}
        <Button disabled={!profile} onClick={() => setTool("reading")} variant="primary">
          {overview.studyPlan ? "Continue reading practice" : "Start diagnostic"}
        </Button>
      </section>
      <section className="ielts-progress-card">
        <div>
          <p className="eyebrow">PROGRESS HISTORY</p>
          <h2>
            {overview.attempts.length} saved attempt{overview.attempts.length === 1 ? "" : "s"}
          </h2>
        </div>
        {overview.attempts.length ? (
          <ul>
            {overview.attempts.slice(0, 5).map((attempt) => (
              <li key={attempt.id}>
                <span>
                  <strong>{attempt.title}</strong>
                  <small>
                    {attempt.skill} · {attempt.status.replaceAll("_", " ")}
                  </small>
                </span>
                {attempt.estimatedBand ? (
                  <Badge tone="teal">Est. {attempt.estimatedBand.toFixed(1)}</Badge>
                ) : (
                  <Badge tone="amber">Resume</Badge>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No practice history yet"
            description="Complete the original diagnostic to begin your progress history."
          />
        )}
      </section>
      <section className="ielts-resources-card">
        <p className="eyebrow">OFFICIAL RESOURCES</p>
        <h2>Verify with the test owners</h2>
        <p>WAYFOUND practice is separate from official IELTS materials and results.</p>
        <ul>
          {overview.resources.map((resource) => (
            <li key={resource.id}>
              <a href={resource.url} rel="noopener noreferrer" target="_blank">
                {resource.title}
                <span>{resource.publisher} ↗</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ReadingPanel({
  content,
  fixture,
  initialInterrupted,
}: {
  content: IeltsContentView;
  fixture: boolean;
  initialInterrupted: boolean;
}) {
  const parsed = readingContentSchema.safeParse(content.content);
  const [started, setStarted] = useState(initialInterrupted);
  const [attemptId, setAttemptId] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [startedAt, setStartedAt] = useState(Date.now());
  const [elapsedBefore, setElapsedBefore] = useState(initialInterrupted ? 90 : 0);
  const [remaining, setRemaining] = useState(remainingSeconds(content.durationSeconds, elapsedBefore));
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(timerKey) ?? "null") as {
        contentId?: string;
        attemptId?: string;
        idempotencyKey?: string;
        startedAt?: number;
        elapsedBefore?: number;
      } | null;
      if (saved?.contentId === content.id && saved.idempotencyKey && saved.startedAt) {
        setStarted(true);
        setAttemptId(saved.attemptId ?? "");
        setIdempotencyKey(saved.idempotencyKey);
        setStartedAt(saved.startedAt);
        setElapsedBefore(saved.elapsedBefore ?? 0);
      }
    } catch {
      sessionStorage.removeItem(timerKey);
    }
  }, [content.id]);
  useEffect(() => {
    if (!started || result) return;
    const tick = () =>
      setRemaining(remainingSeconds(content.durationSeconds, elapsedBefore, (Date.now() - startedAt) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [content.durationSeconds, elapsedBefore, result, started, startedAt]);
  if (!parsed.success)
    return (
      <Notice
        title="Reading task unavailable"
        copy="This content did not pass the practice schema and was not displayed."
        tone="error"
      />
    );
  const begin = async () => {
    const key = idempotencyKey || crypto.randomUUID();
    const now = Date.now();
    let persistedAttemptId = attemptId;
    setError("");
    if (!fixture) {
      const response = await fetch("/api/ielts/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentId: content.id,
          attemptKind: content.activityKind,
          idempotencyKey: key,
        }),
      });
      const body = (await response.json().catch(() => null)) as { attemptId?: string; error?: string } | null;
      if (!response.ok || !body?.attemptId) return setError(body?.error ?? "The timer could not start.");
      persistedAttemptId = body.attemptId;
      setAttemptId(body.attemptId);
    }
    setIdempotencyKey(key);
    setStartedAt(now);
    setStarted(true);
    sessionStorage.setItem(
      timerKey,
      JSON.stringify({
        contentId: content.id,
        attemptId: persistedAttemptId,
        idempotencyKey: key,
        startedAt: now,
        elapsedBefore,
      }),
    );
  };
  const pause = async () => {
    const elapsed = Math.min(
      content.durationSeconds,
      elapsedBefore + Math.floor((Date.now() - startedAt) / 1000),
    );
    if (!fixture && attemptId)
      await fetch("/api/ielts/attempts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, elapsedSeconds: elapsed }),
      });
    setElapsedBefore(elapsed);
    setStarted(false);
    sessionStorage.setItem(
      timerKey,
      JSON.stringify({
        contentId: content.id,
        attemptId,
        idempotencyKey,
        startedAt: Date.now(),
        elapsedBefore: elapsed,
      }),
    );
  };
  const submit = async (form: HTMLFormElement) => {
    setSubmitting(true);
    setError("");
    const data = new FormData(form);
    const answers = Object.fromEntries(
      parsed.data.questions.map((question) => [question.id, String(data.get(question.id) ?? "")]),
    );
    const elapsedSeconds = Math.min(
      content.durationSeconds,
      elapsedBefore + Math.floor((Date.now() - startedAt) / 1000),
    );
    if (fixture) {
      const score = Object.values(answers).filter(Boolean).length;
      setResult({
        score,
        maximum: parsed.data.questions.length,
        estimatedBand: Math.round((3 + (6 * score) / parsed.data.questions.length) * 2) / 2,
      });
    } else {
      const response = await fetch("/api/ielts/reading", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentId: content.id,
          attemptKind: content.activityKind,
          idempotencyKey,
          answers,
          elapsedSeconds,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        result?: ReadingResult;
        error?: string;
      } | null;
      if (!response.ok || !body?.result) {
        setError(body?.error ?? "Your answers were not marked complete.");
        setSubmitting(false);
        return;
      }
      setResult(body.result);
    }
    sessionStorage.removeItem(timerKey);
    setSubmitting(false);
  };
  return (
    <section className="ielts-practice-card" aria-labelledby="reading-title">
      <header>
        <div>
          <p className="eyebrow">
            {content.activityKind.toUpperCase()} · {content.testType.toUpperCase()}
          </p>
          <h2 id="reading-title">{content.title}</h2>
          <p>{content.instructions}</p>
        </div>
        <div className="ielts-timer" aria-live="polite">
          <span>Time remaining</span>
          <strong>
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </strong>
        </div>
      </header>
      <Provenance content={content} />
      {!started && !result ? (
        <Button onClick={() => void begin()} variant="primary">
          {elapsedBefore ? "Resume timed practice" : "Start timed diagnostic"}
        </Button>
      ) : null}
      {started && !result ? (
        <form
          className="ielts-reading-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(event.currentTarget);
          }}
        >
          <article className="ielts-passage">
            <h3>Original practice passage</h3>
            <p>{parsed.data.passage}</p>
          </article>
          {parsed.data.questions.map((question, index) => (
            <fieldset key={question.id}>
              <legend>
                {index + 1}. {question.prompt}
              </legend>
              {question.options.map((option) => (
                <label key={option}>
                  <input name={question.id} required type="radio" value={option} />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <div className="ielts-action-row">
            <Button loading={submitting} type="submit" variant="teal">
              Score my answers
            </Button>
            <Button onClick={() => void pause()} type="button" variant="secondary">
              Pause safely
            </Button>
          </div>
        </form>
      ) : null}
      {result ? (
        <Notice
          title={`${result.score}/${result.maximum} correct · estimated band ${result.estimatedBand.toFixed(1)}`}
          copy="This deterministic WAYFOUND practice estimate is not an official IELTS score or score conversion."
          tone="success"
        />
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function WritingPanel({
  content,
  fixture,
  providerConfigured,
}: {
  content: IeltsContentView;
  fixture: boolean;
  providerConfigured: boolean;
}) {
  const parsed = writingContentSchema.safeParse(content.content);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    estimatedBand: number;
    summary: string;
    recommendations: string[];
  } | null>(null);
  const [error, setError] = useState("");
  if (!parsed.success)
    return (
      <Notice
        title="Writing task unavailable"
        copy="This content did not pass the governed task schema."
        tone="error"
      />
    );
  const submit = async () => {
    setPending(true);
    setError("");
    if (fixture)
      setFeedback({
        estimatedBand: 6.5,
        summary: "The response presents a clear overview and can compare the main changes more directly.",
        recommendations: [
          "Use one comparison in each body paragraph.",
          "Check sentence boundaries before submitting.",
        ],
      });
    else {
      const response = await fetch("/api/ielts/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentId: content.id,
          idempotencyKey: crypto.randomUUID(),
          skill: "writing",
          responseText: text,
          elapsedSeconds: 0,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        feedback?: {
          estimated_band?: number;
          estimatedBand?: number;
          summary: string;
          recommendations: string[];
        };
        error?: string;
      } | null;
      if (!response.ok || !body?.feedback)
        setError(body?.error ?? "Estimated feedback could not be created.");
      else
        setFeedback({
          estimatedBand: body.feedback.estimated_band ?? body.feedback.estimatedBand ?? 0,
          summary: body.feedback.summary,
          recommendations: body.feedback.recommendations,
        });
    }
    setPending(false);
  };
  return (
    <section className="ielts-practice-card" aria-labelledby="writing-title">
      <header>
        <div>
          <p className="eyebrow">ORIGINAL WRITING PRACTICE</p>
          <h2 id="writing-title">{content.title}</h2>
          <p>{content.instructions}</p>
        </div>
      </header>
      <Provenance content={content} />
      <div className="ielts-task-prompt">
        <strong>Your task</strong>
        <p>{parsed.data.prompt}</p>
      </div>
      {!providerConfigured ? (
        <Notice
          title="Estimated writing feedback is not configured"
          copy="You can review the original task, but no AI success is simulated. Reading practice remains available."
          tone="warning"
        />
      ) : null}
      <FormField
        hint={`${countWords(text)} words · minimum ${parsed.data.minimum_words}`}
        label="Your response"
      >
        <textarea
          aria-label="Writing response"
          maxLength={8000}
          onChange={(event) => setText(event.target.value)}
          rows={12}
          value={text}
        />
      </FormField>
      <Button
        disabled={!providerConfigured || countWords(text) < Math.min(40, parsed.data.minimum_words)}
        loading={pending}
        onClick={() => void submit()}
        variant="teal"
      >
        Request estimated feedback
      </Button>
      {feedback ? <FeedbackCard feedback={feedback} skill="writing" /> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SpeakingPanel({
  content,
  fixture,
  profile,
  providerConfigured,
}: {
  content: IeltsContentView;
  fixture: boolean;
  profile: IeltsProfileView | null;
  providerConfigured: boolean;
}) {
  const parsed = speakingContentSchema.safeParse(content.content);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [feedback, setFeedback] = useState<{
    estimatedBand: number;
    summary: string;
    recommendations: string[];
  } | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const request = useRef<XMLHttpRequest | null>(null);
  useEffect(() => {
    if (sessionStorage.getItem(recordingRecoveryKey))
      setError(
        "A previous upload was interrupted. Choose or record the audio again; your transcript is preserved only on this device.",
      );
    const saved = sessionStorage.getItem(`${recordingRecoveryKey}:transcript`);
    if (saved) setTranscript(saved.slice(0, 12000));
  }, []);
  if (!parsed.success)
    return (
      <Notice
        title="Speaking task unavailable"
        copy="This content did not pass the governed task schema."
        tone="error"
      />
    );
  const beginRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunks.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      recorder.onstop = () => {
        const recorded = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
        setBlob(recorded);
        setFile(new File([recorded], "speaking-practice.webm", { type: recorded.type }));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setRecording(true);
    } catch {
      setError(
        "Microphone permission was denied or unavailable. You can choose an existing audio file instead.",
      );
    }
  };
  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };
  const upload = async () => {
    if ((!file && !blob) || !profile) return;
    setPending(true);
    setError("");
    setProgress(0);
    const key = crypto.randomUUID();
    sessionStorage.setItem(recordingRecoveryKey, key);
    sessionStorage.setItem(`${recordingRecoveryKey}:transcript`, transcript);
    if (fixture) {
      setProgress(100);
      setFeedback({
        estimatedBand: 6.5,
        summary:
          "The transcript develops the topic clearly. This basic estimate does not assess pronunciation.",
        recommendations: [
          "Use clearer sequencing language.",
          "Record another answer with fewer long pauses.",
        ],
      });
      sessionStorage.removeItem(recordingRecoveryKey);
      setPending(false);
      return;
    }
    const data = new FormData();
    data.set("file", file!);
    data.set("contentId", content.id);
    data.set("idempotencyKey", key);
    data.set("transcript", transcript);
    data.set("retentionDays", String(profile.recordingRetentionDays));
    const result = await new Promise<{ ok: boolean; recordingId?: string; error?: string }>((resolve) => {
      const xhr = new XMLHttpRequest();
      request.current = xhr;
      xhr.open("POST", "/api/ielts/speaking/upload");
      xhr.upload.onprogress = (event) =>
        event.lengthComputable && setProgress(Math.round((event.loaded / event.total) * 100));
      xhr.onload = () => {
        try {
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, ...JSON.parse(xhr.responseText) });
        } catch {
          resolve({ ok: false, error: "The upload response was invalid." });
        }
      };
      xhr.onerror = () =>
        resolve({ ok: false, error: "The upload was interrupted. Choose the audio again to retry." });
      xhr.onabort = () =>
        resolve({ ok: false, error: "Upload cancelled. Your transcript remains on this device." });
      xhr.send(data);
    });
    if (!result.ok || !result.recordingId) {
      setError(result.error ?? "The upload did not complete.");
      setPending(false);
      return;
    }
    const feedbackResponse = await fetch("/api/ielts/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentId: content.id,
        idempotencyKey: key,
        skill: "speaking",
        responseText: transcript,
        elapsedSeconds: content.durationSeconds,
        recordingId: result.recordingId,
      }),
    });
    const body = (await feedbackResponse.json().catch(() => null)) as {
      feedback?: {
        estimated_band?: number;
        estimatedBand?: number;
        summary: string;
        recommendations: string[];
      };
      error?: string;
    } | null;
    if (!feedbackResponse.ok || !body?.feedback)
      setError(
        body?.error ?? "The recording was saved, but feedback could not be created. Retry feedback later.",
      );
    else {
      setFeedback({
        estimatedBand: body.feedback.estimated_band ?? body.feedback.estimatedBand ?? 0,
        summary: body.feedback.summary,
        recommendations: body.feedback.recommendations,
      });
      sessionStorage.removeItem(recordingRecoveryKey);
      sessionStorage.removeItem(`${recordingRecoveryKey}:transcript`);
    }
    setPending(false);
  };
  return (
    <section className="ielts-practice-card" aria-labelledby="speaking-title">
      <header>
        <div>
          <p className="eyebrow">PRIVATE SPEAKING PRACTICE</p>
          <h2 id="speaking-title">{content.title}</h2>
          <p>{content.instructions}</p>
        </div>
      </header>
      <Provenance content={content} />
      <div className="ielts-task-prompt">
        <strong>Your prompt</strong>
        <p>{parsed.data.prompt}</p>
      </div>
      <Notice
        title="Transcript-based estimate"
        copy="Your recording is stored privately. Phase 13 feedback uses your transcript and does not claim to assess pronunciation."
      />
      {!profile ? (
        <Notice
          title="Set recording retention first"
          copy="Save your IELTS goal before recording so you control when the private audio expires."
          tone="warning"
        />
      ) : null}
      {!providerConfigured ? (
        <Notice
          title="Speaking feedback provider is not configured"
          copy="No feedback success will be simulated. You may return when the provider is available."
          tone="warning"
        />
      ) : null}
      <div className="ielts-recorder">
        <Button disabled={!profile || recording} onClick={() => void beginRecording()} variant="primary">
          Start microphone recording
        </Button>
        <Button disabled={!recording} onClick={stopRecording} variant="secondary">
          Stop recording
        </Button>
        <label className="ielts-file-label">
          Or choose audio
          <input
            accept="audio/webm,audio/wav,audio/ogg,audio/mp4,.m4a"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        {file ? <span role="status">Audio selected: {file.name}</span> : null}
      </div>
      <FormField
        hint="Review the words carefully. Feedback is based on this transcript, not inferred audio details."
        label="Transcript"
      >
        <textarea
          aria-label="Speaking transcript"
          maxLength={12000}
          onChange={(event) => {
            setTranscript(event.target.value);
            sessionStorage.setItem(`${recordingRecoveryKey}:transcript`, event.target.value);
          }}
          rows={8}
          value={transcript}
        />
      </FormField>
      <Button
        disabled={!providerConfigured || !profile || !file || transcript.trim().length < 40}
        loading={pending}
        onClick={() => void upload()}
        variant="teal"
      >
        Upload privately and request feedback
      </Button>
      {pending ? (
        <div className="ielts-upload-progress" role="status">
          <progress aria-label="Speaking upload progress" max="100" value={progress} />
          <span>{progress}% uploaded</span>
          <Button onClick={() => request.current?.abort()} variant="secondary">
            Cancel upload
          </Button>
        </div>
      ) : null}
      {feedback ? <FeedbackCard feedback={feedback} skill="speaking" /> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function FeedbackCard({
  feedback,
  skill,
}: {
  feedback: { estimatedBand: number; summary: string; recommendations: string[] };
  skill: "writing" | "speaking";
}) {
  return (
    <section className="ielts-feedback-card" aria-labelledby={`${skill}-feedback-title`}>
      <Badge tone="amber">Unofficial estimate</Badge>
      <h3 id={`${skill}-feedback-title`}>Estimated band {feedback.estimatedBand.toFixed(1)}</h3>
      <p>{feedback.summary}</p>
      <h4>Try next</h4>
      <ul>
        {feedback.recommendations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
function Provenance({ content }: { content: IeltsContentView }) {
  return (
    <div className="ielts-provenance">
      <Badge tone="teal">
        {content.provenanceType === "original" ? "Original WAYFOUND task" : "Licensed content"}
      </Badge>
      <span>
        {content.provenanceTitle} · {content.provenanceAuthor} · licence approved
      </span>
    </div>
  );
}
