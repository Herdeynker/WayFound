"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  ProgressIndicator,
  Select,
  TextArea,
} from "@/components/ui";
import {
  countryOptions,
  documentTypes,
  emptyPassportState,
  goalCatalog,
  type GoalType,
  type PassportState,
  type SectionId,
  visibleSections,
} from "./model";
import { calculateCompletion, findContradictions } from "@/server/passport/completion";

type Props = { fixture?: boolean };
const sectionLabels: Record<SectionId, string> = {
  goals: "Your goals",
  origin: "About you",
  destinations: "Destinations",
  academic: "Academic history",
  professional: "Professional history",
  skills: "Skills",
  certifications: "Certifications",
  trade: "Skilled or trade experience",
  language: "Language profile",
  documents: "Document readiness",
  review: "Review & confirm",
};

const inputRecord = <T extends object>(record: T, key: keyof T, value: unknown): T =>
  ({ ...record, [key]: value }) as T;

export function PassportWizard({ fixture = false }: Props) {
  const [state, setState] = useState<PassportState>(() =>
    fixture ? { ...emptyPassportState, selectedGoals: [] } : emptyPassportState,
  );
  const [current, setCurrent] = useState<SectionId>("goals");
  const [loading, setLoading] = useState(!fixture);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    fixture ? "saved" : "idle",
  );
  const [message, setMessage] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sections = useMemo(() => visibleSections(state.selectedGoals), [state.selectedGoals]);
  const completion = useMemo(() => calculateCompletion(state), [state]);
  const contradictions = useMemo(() => findContradictions(state), [state]);

  useEffect(() => {
    if (fixture) return;
    fetch("/api/passport")
      .then(async (response) => {
        if (!response.ok) throw new Error("We could not resume your Passport.");
        return response.json();
      })
      .then((data) => {
        if (data.state) setState(data.state);
        if (data.progress?.current_section && sections.includes(data.progress.current_section))
          setCurrent(data.progress.current_section);
        setSaveState("saved");
      })
      .catch(() => setMessage("We could not load your latest draft. You can continue and retry saving."))
      .finally(() => setLoading(false));
    // Loading the remote draft is intentionally a one-time operation.
  }, [fixture]);

  useEffect(() => {
    if (fixture || loading) return;
    window.localStorage.setItem("wayfound-passport-draft", JSON.stringify(state));
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/passport", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, currentSection: current }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("save");
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 650);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [current, fixture, loading, state]);

  function update(patch: Partial<PassportState>) {
    setState((value) => ({ ...value, ...patch }));
    setMessage("");
  }
  function changeSection(next: SectionId) {
    setCurrent(next);
    if (typeof window !== "undefined" && !window.navigator.userAgent.includes("jsdom")) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  const index = Math.max(0, sections.indexOf(current));
  const goNext = () => {
    const next = sections[index + 1];
    if (next) changeSection(next);
  };
  const goBack = () => {
    const previous = sections[index - 1];
    if (previous) changeSection(previous);
  };
  async function confirm() {
    if (contradictions.length) {
      setMessage("Resolve the highlighted contradictions before confirming.");
      return;
    }
    if (fixture) {
      setMessage("Fixture review confirmed. In production this creates an immutable Passport version.");
      return;
    }
    setSaveState("saving");
    const response = await fetch("/api/passport", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state, currentSection: "review", confirm: true }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSaveState("error");
      setMessage(data.error ?? "We could not confirm your Passport.");
      return;
    }
    setSaveState("saved");
    setMessage("Your Passport is confirmed and versioned. You can keep improving it from your dashboard.");
  }

  if (loading)
    return (
      <main className="passport-page">
        <Card className="passport-loading">
          <p className="card-eyebrow">Opportunity Passport</p>
          <h1>Restoring your path…</h1>
          <p>We’re bringing back the latest saved step.</p>
        </Card>
      </main>
    );
  return (
    <main className="passport-page" id="main-content">
      <div className="passport-header">
        <div>
          <p className="card-eyebrow">WAYFOUND · OPPORTUNITY PASSPORT</p>
          <h1>Build a profile that travels with you.</h1>
          <p>Answer what matters for your goals. You can save, step back and return whenever you need.</p>
        </div>
        <a className="passport-exit" href="/dashboard">
          Return to dashboard
        </a>
      </div>
      <div className="passport-layout">
        <aside className="passport-progress" aria-label="Passport sections">
          <div className="passport-score">
            <span>Passport readiness</span>
            <strong>{completion.overall}%</strong>
            <ProgressIndicator label="Passport readiness" value={completion.overall} />
          </div>
          <nav>
            {sections.map((section, itemIndex) => (
              <button
                aria-current={section === current ? "step" : undefined}
                className={section === current ? "is-current" : ""}
                key={section}
                onClick={() => changeSection(section)}
                type="button"
              >
                <span>{itemIndex + 1}</span>
                {sectionLabels[section]}
                {itemIndex < index ? <b aria-label="Completed">✓</b> : null}
              </button>
            ))}
          </nav>
          <p className="passport-save-status" role="status">
            {saveState === "saving"
              ? "Saving your progress…"
              : saveState === "error"
                ? "Save failed · Retry by editing or continue"
                : "Your progress is saved"}
          </p>
        </aside>
        <section className="passport-content" aria-live="polite">
          <div className="passport-step-heading">
            <span>
              Step {index + 1} of {sections.length}
            </span>
            <h2>{sectionLabels[current]}</h2>
            <p>{stepDescription(current)}</p>
          </div>
          {current === "goals" ? (
            <GoalsSection
              selected={state.selectedGoals}
              onChange={(selectedGoals) => update({ selectedGoals })}
            />
          ) : null}
          {current === "origin" ? <OriginSection state={state} update={update} /> : null}
          {current === "destinations" ? <DestinationSection state={state} update={update} /> : null}
          {current === "academic" ? <AcademicSection state={state} update={update} /> : null}
          {current === "professional" ? <ProfessionalSection state={state} update={update} /> : null}
          {current === "skills" ? <SkillsSection state={state} update={update} /> : null}
          {current === "certifications" ? <CertificationSection state={state} update={update} /> : null}
          {current === "trade" ? <TradeSection state={state} update={update} /> : null}
          {current === "language" ? <LanguageSection state={state} update={update} /> : null}
          {current === "documents" ? (
            <DocumentsSection state={state} update={update} fixture={fixture} />
          ) : null}
          {current === "review" ? (
            <ReviewSection
              state={state}
              completion={completion}
              contradictions={contradictions}
              onConfirm={confirm}
            />
          ) : null}
          {message ? (
            <p className={saveState === "error" ? "auth-error" : "auth-success"} role="status">
              {message}
            </p>
          ) : null}
          <div className="passport-actions">
            <Button disabled={index === 0} onClick={goBack} variant="quiet">
              Back
            </Button>
            {current === "review" ? (
              <Button onClick={confirm} variant="primary">
                Confirm my Passport <span aria-hidden="true">→</span>
              </Button>
            ) : (
              <Button disabled={current === "goals" && state.selectedGoals.length === 0} onClick={goNext}>
                Save and continue <span aria-hidden="true">→</span>
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function stepDescription(section: SectionId) {
  const copy: Record<SectionId, string> = {
    goals: "Choose one or more directions. This shapes the questions we show you.",
    origin: "Only the context that helps us understand where you are starting from.",
    destinations: "Choose places and preferences without limiting your future options.",
    academic: "Add the learning history that supports your selected routes.",
    professional: "Tell us about experience that can travel across applications.",
    skills: "Add normalized skills and your own confidence level.",
    certifications: "List credentials as supplied; WAYFOUND does not verify them at this stage.",
    trade: "Practical experience is useful context, but licensing rules vary by destination.",
    language: "Separate official test results from self-assessment and future practice.",
    documents: "Record readiness and upload a basic CV privately when you are ready.",
    review: "Check what will be used for future matching before creating a version.",
  };
  return copy[section];
}

function GoalsSection({
  selected,
  onChange,
}: {
  selected: GoalType[];
  onChange: (value: GoalType[]) => void;
}) {
  return (
    <div className="passport-goals">
      {goalCatalog.map((goal) => {
        const checked = selected.includes(goal.id);
        return (
          <button
            aria-pressed={checked}
            className={`passport-goal ${checked ? "is-selected" : ""}`}
            key={goal.id}
            onClick={() =>
              onChange(checked ? selected.filter((item) => item !== goal.id) : [...selected, goal.id])
            }
            type="button"
          >
            <span className="passport-goal-mark">{checked ? "✓" : "＋"}</span>
            <span>
              <small>{goal.eyebrow}</small>
              <strong>{goal.title}</strong>
              <em>{goal.description}</em>
            </span>
          </button>
        );
      })}
      <p className="passport-hint">
        You can add or remove a goal later. Removing a goal hides its pathway questions but keeps reusable
        answers safe.
      </p>
    </div>
  );
}

function OriginSection({
  state,
  update,
}: {
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  return (
    <div className="passport-form-grid">
      <FormField label="Preferred or display name">
        <Input
          value={state.preferredName}
          onChange={(event) => update({ preferredName: event.target.value })}
          placeholder="What should we call you?"
        />
      </FormField>
      <FormField
        hint="This helps with destination context; it is not used as an eligibility decision."
        label="Country of citizenship"
      >
        <Input
          value={state.citizenshipCountry}
          onChange={(event) => update({ citizenshipCountry: event.target.value })}
          placeholder="Nigeria"
        />
      </FormField>
      <FormField label="Current country of residence">
        <Input
          value={state.residenceCountry}
          onChange={(event) => update({ residenceCountry: event.target.value })}
          placeholder="Nigeria"
        />
      </FormField>
      <FormField label="Current city or region">
        <Input
          value={state.currentRegion}
          onChange={(event) => update({ currentRegion: event.target.value })}
          placeholder="Lagos"
        />
      </FormField>
      <FormField label="When might you relocate?">
        <Select
          value={state.relocationTimeline}
          onChange={(event) => update({ relocationTimeline: event.target.value })}
        >
          <option value="">Choose one</option>
          <option>Within 6 months</option>
          <option>6–12 months</option>
          <option>12–24 months</option>
          <option>Exploring</option>
        </Select>
      </FormField>
      <FormField label="Passport expiry (optional)">
        <Input
          type="date"
          value={state.passportExpiry}
          onChange={(event) => update({ passportExpiry: event.target.value })}
        />
      </FormField>
      <Checkbox
        checked={state.passportAvailable ?? false}
        label="I have a passport available"
        onChange={(event) => update({ passportAvailable: event.target.checked })}
      />
      <Checkbox
        checked={state.willingToRelocate ?? false}
        label="I am open to relocating for the right route"
        onChange={(event) => update({ willingToRelocate: event.target.checked })}
      />
    </div>
  );
}

function DestinationSection({
  state,
  update,
}: {
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  return (
    <div className="passport-section-stack">
      <fieldset>
        <legend>Preferred destinations</legend>
        <div className="passport-country-grid">
          {countryOptions.map(([code, label]) => (
            <Checkbox
              checked={state.destinations.includes(code)}
              key={code}
              label={label}
              onChange={(event) =>
                update({
                  destinations: event.target.checked
                    ? [...state.destinations, code]
                    : state.destinations.filter((item) => item !== code),
                })
              }
            />
          ))}
        </div>
      </fieldset>
      <Checkbox
        checked={state.openToOtherDestinations}
        label="I am open to other destinations too"
        onChange={(event) => update({ openToOtherDestinations: event.target.checked })}
      />
      <div className="passport-form-grid">
        <FormField label="Preferred start timeframe">
          <Input
            value={state.startTimeframe}
            onChange={(event) => update({ startTimeframe: event.target.value })}
            placeholder="For example, 2027 intake"
          />
        </FormField>
        <FormField label="Funding or salary context">
          <Input
            value={state.fundingRequirement}
            onChange={(event) => update({ fundingRequirement: event.target.value })}
            placeholder="Fully funded, flexible, etc."
          />
        </FormField>
        <FormField label="Work mode where relevant">
          <Select value={state.workMode} onChange={(event) => update({ workMode: event.target.value })}>
            <option value="">Choose one</option>
            <option>On-site</option>
            <option>Hybrid</option>
            <option>Remote</option>
            <option>Flexible</option>
          </Select>
        </FormField>
      </div>
    </div>
  );
}

function AcademicSection({
  state,
  update,
}: {
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  const record = state.education[0] ?? {
    institution: "",
    country: "",
    qualificationLevel: "",
    fieldOfStudy: "",
    startDate: "",
    completionDate: "",
    graduationStatus: "completed",
    gradeClassification: "",
    gpaValue: null,
    gpaScale: null,
    resultPending: false,
    expectedGraduationDate: "",
    transcriptAvailable: null,
    researchExperience: "",
    publications: "",
    academicAwards: "",
  };
  const set = (key: keyof typeof record, value: unknown) =>
    update({ education: [inputRecord(record, key, value) as typeof record] });
  return (
    <div className="passport-form-grid">
      <FormField label="Institution">
        <Input value={record.institution} onChange={(event) => set("institution", event.target.value)} />
      </FormField>
      <FormField label="Country">
        <Input
          value={record.country}
          onChange={(event) => set("country", event.target.value)}
          placeholder="Nigeria"
        />
      </FormField>
      <FormField label="Qualification level">
        <Input
          value={record.qualificationLevel}
          onChange={(event) => set("qualificationLevel", event.target.value)}
          placeholder="BSc, MSc, HND…"
        />
      </FormField>
      <FormField label="Course or field">
        <Input value={record.fieldOfStudy} onChange={(event) => set("fieldOfStudy", event.target.value)} />
      </FormField>
      <FormField label="Graduation status">
        <Select
          value={record.graduationStatus}
          onChange={(event) => set("graduationStatus", event.target.value)}
        >
          <option value="completed">Completed</option>
          <option value="currently_studying">Currently studying</option>
          <option value="awaiting_graduation">Awaiting graduation</option>
          <option value="result_pending">Result pending</option>
        </Select>
      </FormField>
      <FormField
        hint="Keep the original format; Nigerian classifications are not forced into a 4.0 scale."
        label="Grade or classification"
      >
        <Input
          value={record.gradeClassification}
          onChange={(event) => set("gradeClassification", event.target.value)}
          placeholder="First class, 3.2/5, Distinction…"
        />
      </FormField>
      <FormField label="Research experience (optional)">
        <TextArea
          value={record.researchExperience}
          onChange={(event) => set("researchExperience", event.target.value)}
        />
      </FormField>
      <FormField label="Publications or awards (optional)">
        <TextArea
          value={`${record.publications}${record.academicAwards ? `\n${record.academicAwards}` : ""}`}
          onChange={(event) => set("publications", event.target.value)}
        />
      </FormField>
    </div>
  );
}

function ProfessionalSection({
  state,
  update,
}: {
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  const record = state.employment[0] ?? {
    employer: "",
    jobTitle: "",
    country: "",
    employmentType: "",
    startDate: "",
    endDate: "",
    currentlyEmployed: false,
    responsibilities: "",
    achievements: "",
    industry: "",
    occupationCategory: "",
    managementExperience: null,
    remoteInternationalExperience: null,
  };
  const set = (key: keyof typeof record, value: unknown) =>
    update({ employment: [inputRecord(record, key, value) as typeof record] });
  return (
    <div className="passport-form-grid">
      <FormField label="Employer">
        <Input value={record.employer} onChange={(event) => set("employer", event.target.value)} />
      </FormField>
      <FormField label="Job title">
        <Input value={record.jobTitle} onChange={(event) => set("jobTitle", event.target.value)} />
      </FormField>
      <FormField label="Country">
        <Input value={record.country} onChange={(event) => set("country", event.target.value)} />
      </FormField>
      <FormField label="Employment type">
        <Input
          value={record.employmentType}
          onChange={(event) => set("employmentType", event.target.value)}
          placeholder="Full-time, contract…"
        />
      </FormField>
      <FormField label="Responsibilities">
        <TextArea
          value={record.responsibilities}
          onChange={(event) => set("responsibilities", event.target.value)}
        />
      </FormField>
      <FormField label="Achievements (optional)">
        <TextArea value={record.achievements} onChange={(event) => set("achievements", event.target.value)} />
      </FormField>
      <Checkbox
        checked={record.currentlyEmployed}
        label="I currently work here"
        onChange={(event) => set("currentlyEmployed", event.target.checked)}
      />
    </div>
  );
}

function SkillsSection({
  state,
  update,
}: {
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  const [skill, setSkill] = useState("");
  const add = () => {
    const trimmed = skill.trim();
    if (!trimmed || state.skills.some((item) => item.normalizedName === trimmed.toLocaleLowerCase())) return;
    update({
      skills: [
        ...state.skills,
        {
          skillName: trimmed,
          normalizedName: trimmed.toLocaleLowerCase(),
          category: "other",
          proficiency: "developing",
          yearsExperience: null,
          evidence: "",
        },
      ],
    });
    setSkill("");
  };
  return (
    <div className="passport-section-stack">
      <div className="passport-inline-add">
        <FormField hint="Duplicates are normalized by name." label="Add a skill">
          <Input
            value={skill}
            onChange={(event) => setSkill(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder="Excel, carpentry, project management…"
          />
        </FormField>
        <Button onClick={add} type="button" variant="secondary">
          Add skill
        </Button>
      </div>
      <div className="passport-pill-list">
        {state.skills.map((item, index) => (
          <div className="passport-pill" key={`${item.normalizedName}-${index}`}>
            <strong>{item.skillName}</strong>
            <Select
              aria-label={`Proficiency for ${item.skillName}`}
              value={item.proficiency}
              onChange={(event) =>
                update({
                  skills: state.skills.map((skillItem, itemIndex) =>
                    itemIndex === index
                      ? { ...skillItem, proficiency: event.target.value as typeof skillItem.proficiency }
                      : skillItem,
                  ),
                })
              }
            >
              <option value="beginner">Beginner</option>
              <option value="developing">Developing</option>
              <option value="proficient">Proficient</option>
              <option value="advanced">Advanced</option>
            </Select>
            <button
              aria-label={`Remove ${item.skillName}`}
              onClick={() => update({ skills: state.skills.filter((_, itemIndex) => itemIndex !== index) })}
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {state.skills.length === 0 ? (
        <p className="passport-empty">No skills yet. Add the ones you would confidently discuss.</p>
      ) : null}
    </div>
  );
}

function CertificationSection({
  state,
  update,
}: {
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  const record = state.certifications[0] ?? {
    name: "",
    issuer: "",
    jurisdiction: "",
    issueDate: "",
    expiryDate: "",
    noExpiry: false,
    credentialStatus: "unverified",
    credentialUrl: "",
    occupationOrSkill: "",
  };
  const set = (key: keyof typeof record, value: unknown) =>
    update({ certifications: [inputRecord(record, key, value) as typeof record] });
  return (
    <div className="passport-form-grid">
      <FormField label="Certification or credential">
        <Input value={record.name} onChange={(event) => set("name", event.target.value)} />
      </FormField>
      <FormField label="Issuer">
        <Input value={record.issuer} onChange={(event) => set("issuer", event.target.value)} />
      </FormField>
      <FormField label="Country or jurisdiction">
        <Input value={record.jurisdiction} onChange={(event) => set("jurisdiction", event.target.value)} />
      </FormField>
      <FormField label="Credential URL (optional)">
        <Input
          value={record.credentialUrl}
          onChange={(event) => set("credentialUrl", event.target.value)}
          type="url"
        />
      </FormField>
      <Checkbox
        checked={record.noExpiry}
        label="This credential has no expiry"
        onChange={(event) => set("noExpiry", event.target.checked)}
      />
      <p className="passport-hint">
        Credentials remain user-supplied and unverified until a later evidence workflow.
      </p>
    </div>
  );
}

function TradeSection({
  state,
  update,
}: {
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  const record = state.trade[0] ?? {
    tradeOrOccupation: "",
    apprenticeshipStatus: "not_applicable",
    practicalYears: null,
    experienceDocumentation: "informal",
    employerOrSelfEmployed: "",
    tradeCertification: "",
    licensingStatus: "not_checked",
    portfolioAvailable: null,
    toolsEquipment: "",
    drivingLicenceClasses: "",
    willingToCompleteLicensing: null,
    preferredDestination: "",
  };
  const set = (key: keyof typeof record, value: unknown) =>
    update({ trade: [inputRecord(record, key, value) as typeof record] });
  return (
    <div className="passport-form-grid">
      <FormField label="Trade or occupation">
        <Input
          value={record.tradeOrOccupation}
          onChange={(event) => set("tradeOrOccupation", event.target.value)}
          placeholder="Electrician, welder, chef…"
        />
      </FormField>
      <FormField label="Practical years">
        <Input
          min="0"
          max="80"
          step="0.5"
          type="number"
          value={record.practicalYears ?? ""}
          onChange={(event) => set("practicalYears", event.target.value ? Number(event.target.value) : null)}
        />
      </FormField>
      <FormField label="Experience documentation">
        <Select
          value={record.experienceDocumentation}
          onChange={(event) => set("experienceDocumentation", event.target.value)}
        >
          <option value="informal">Informal experience</option>
          <option value="formally_documented">Formally documented</option>
          <option value="both">Both</option>
        </Select>
      </FormField>
      <FormField label="Licensing status">
        <Select
          value={record.licensingStatus}
          onChange={(event) => set("licensingStatus", event.target.value)}
        >
          <option value="not_checked">Not checked</option>
          <option value="licensed">Licensed</option>
          <option value="in_progress">In progress</option>
          <option value="not_applicable">Not applicable</option>
        </Select>
      </FormField>
      <FormField label="Tools and equipment (optional)">
        <TextArea
          value={record.toolsEquipment}
          onChange={(event) => set("toolsEquipment", event.target.value)}
        />
      </FormField>
      <Checkbox
        checked={record.willingToCompleteLicensing ?? false}
        label="I am open to completing destination licensing if required"
        onChange={(event) => set("willingToCompleteLicensing", event.target.checked)}
      />
      <p className="passport-hint">
        Informal experience can be valuable context, but it does not automatically meet another country’s
        licensing rules.
      </p>
    </div>
  );
}

function LanguageSection({
  state,
  update,
}: {
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  const record = state.languages[0] ?? {
    language: "English",
    proficiency: "self_assessed",
    testName: "",
    testStatus: "not_taken",
    overallScore: null,
    componentScores: {},
    testDate: "",
    expiryDate: "",
    targetScore: null,
    plannedTestDate: "",
  };
  const set = (key: keyof typeof record, value: unknown) =>
    update({ languages: [inputRecord(record, key, value) as typeof record] });
  return (
    <div className="passport-form-grid">
      <FormField label="Language">
        <Input value={record.language} onChange={(event) => set("language", event.target.value)} />
      </FormField>
      <FormField label="Self-assessed proficiency">
        <Select value={record.proficiency} onChange={(event) => set("proficiency", event.target.value)}>
          <option value="self_assessed">Self-assessed</option>
          <option>Basic</option>
          <option>Intermediate</option>
          <option>Advanced</option>
          <option>Native</option>
        </Select>
      </FormField>
      <FormField label="Test status">
        <Select value={record.testStatus} onChange={(event) => set("testStatus", event.target.value)}>
          <option value="not_taken">Not taken</option>
          <option value="booked">Booked</option>
          <option value="official">Official result</option>
          <option value="practice_estimate">WAYFOUND practice estimate</option>
        </Select>
      </FormField>
      <FormField
        hint="IELTS scores are 0–9. Practice estimates are never official results."
        label="Overall score"
      >
        <Input
          min="0"
          max="9"
          step="0.5"
          type="number"
          value={record.overallScore ?? ""}
          onChange={(event) => set("overallScore", event.target.value ? Number(event.target.value) : null)}
        />
      </FormField>
    </div>
  );
}

function DocumentsSection({
  state,
  update,
  fixture,
}: {
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
  fixture: boolean;
}) {
  const [upload, setUpload] = useState<"idle" | "uploading" | "uploaded" | "failed">("idle");
  async function uploadFile(file: File) {
    if (fixture) {
      setUpload("uploaded");
      return;
    }
    setUpload("uploading");
    const data = new FormData();
    data.set("file", file);
    data.set("documentType", "cv_resume");
    const response = await fetch("/api/passport/documents", { method: "POST", body: data });
    setUpload(response.ok ? "uploaded" : "failed");
  }
  return (
    <div className="passport-section-stack">
      <div className="document-upload-card">
        <p className="card-eyebrow">Basic CV upload</p>
        <h3>Bring a CV if you have one</h3>
        <p>
          Stored privately in your account. We capture metadata and readiness; this does not verify your
          documents.
        </p>
        <label className="passport-file-input">
          Choose CV or take a document photo
          <input
            accept="application/pdf,.docx,image/jpeg,image/png"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
            }}
            type="file"
          />
        </label>
        <p className="passport-upload-status" role="status">
          {upload === "uploading"
            ? "Uploading securely…"
            : upload === "uploaded"
              ? "Uploaded privately. No public URL was created."
              : upload === "failed"
                ? "Upload failed. Check the file and retry."
                : "PDF, DOCX, JPG or PNG · up to 10 MB"}
        </p>
      </div>
      <fieldset>
        <legend>Readiness, not verification</legend>
        {documentTypes.slice(0, 6).map((type) => {
          const existing = state.documents.find((item) => item.type === type);
          return (
            <div className="document-row" key={type}>
              <span>{type.replaceAll("_", " ")}</span>
              <Select
                aria-label={`Readiness for ${type.replaceAll("_", " ")}`}
                value={existing?.status ?? "not_applicable"}
                onChange={(event) =>
                  update({
                    documents: [
                      ...state.documents.filter((item) => item.type !== type),
                      {
                        type,
                        status: event.target.value as
                          "available" | "unavailable" | "expired" | "pending" | "not_applicable",
                        uploadStatus: existing?.uploadStatus ?? "idle",
                      },
                    ],
                  })
                }
              >
                <option value="not_applicable">Not applicable</option>
                <option value="available">Available</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="unavailable">Unavailable</option>
              </Select>
            </div>
          );
        })}
      </fieldset>
    </div>
  );
}

function ReviewSection({
  state,
  completion,
  contradictions,
  onConfirm,
}: {
  state: PassportState;
  completion: ReturnType<typeof calculateCompletion>;
  contradictions: string[];
  onConfirm: () => void;
}) {
  return (
    <div className="passport-review">
      <div className="passport-review-score">
        <strong>{completion.overall}%</strong>
        <span>overall completion</span>
      </div>
      <p>
        Completeness is not eligibility. It only shows how much relevant context you have confirmed for the
        goals you chose.
      </p>
      <div className="passport-pathway-list">
        {state.selectedGoals.map((goal) => (
          <div key={goal}>
            <span>{goalCatalog.find((item) => item.id === goal)?.title}</span>
            <strong>{completion.pathways[goal]}%</strong>
          </div>
        ))}
      </div>
      {completion.missing.length ? (
        <div className="passport-missing">
          <strong>Still useful to add</strong>
          <ul>
            {completion.missing.slice(0, 8).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {contradictions.length ? (
        <div className="auth-error">
          <strong>Review needed</strong>
          <ul>
            {contradictions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="passport-hint">
        Confirming creates an immutable profile version. Autosave drafts remain separate, and future CV
        suggestions will always ask before changing a field.
      </p>
      <Button disabled={Boolean(contradictions.length)} onClick={onConfirm}>
        Confirm and create Passport version
      </Button>
    </div>
  );
}
