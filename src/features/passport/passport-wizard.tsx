"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, FormField, Input, ProgressIndicator, Select, TextArea } from "@/components/ui";
import {
  activePathways,
  countryOptions,
  emptyPassportState,
  focusPathCopy,
  goalCatalog,
  mapLegacySectionToStage,
  onboardingStageIds,
  onboardingStages,
  pathwayFlags,
  resolveFocusPath,
  type OnboardingFocusPath,
  type OnboardingStageId,
  type PassportState,
} from "./model";
import { calculateActivation, calculateCompletion, findContradictions } from "@/server/passport/completion";

type Props = {
  fixture?: boolean;
  fixtureScenario?: "default" | "saving" | "error" | "resumed" | "permission";
  enrichment?: boolean;
  afterConfirmHref?: "/dashboard" | "/pricing?onboarding=complete";
};
type SaveState = "idle" | "saving" | "saved" | "error";
type AnalyticsEvent =
  | "onboarding_started"
  | "onboarding_stage_viewed"
  | "onboarding_stage_completed"
  | "onboarding_stage_abandoned"
  | "onboarding_resumed"
  | "optional_field_deferred"
  | "review_edit_requested"
  | "onboarding_focus_path_viewed"
  | "onboarding_focus_path_selected"
  | "onboarding_focus_path_changed"
  | "onboarding_exploring_selected"
  | "onboarding_deferred_path";

const educationBlank: PassportState["education"][number] = {
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
const employmentBlank: PassportState["employment"][number] = {
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
const tradeBlank: PassportState["trade"][number] = {
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
const languageBlank: PassportState["languages"][number] = {
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
const certificationBlank: PassportState["certifications"][number] = {
  name: "Professional credential",
  issuer: "",
  jurisdiction: "",
  issueDate: "",
  expiryDate: "",
  noExpiry: false,
  credentialStatus: "pending",
  credentialUrl: "",
  occupationOrSkill: "",
};

function replaceFirst<T>(values: T[], fallback: T, patch: Partial<T>): T[] {
  return [{ ...(values[0] ?? fallback), ...patch }];
}

function stageNumber(stage: OnboardingStageId) {
  return onboardingStageIds.indexOf(stage) + 1;
}

function draftFingerprint(state: PassportState, stage: OnboardingStageId) {
  return JSON.stringify([stage, state]);
}

export function PassportWizard({
  fixture = false,
  fixtureScenario = "default",
  enrichment = false,
  afterConfirmHref = "/pricing?onboarding=complete",
}: Props) {
  const fixtureDraft = useMemo<PassportState>(
    () =>
      fixtureScenario === "resumed"
        ? {
            ...emptyPassportState,
            selectedGoals: ["professional_sponsorship"],
            destinations: ["CA"],
            employment: [{ ...employmentBlank, jobTitle: "Product designer", employmentType: "employed" }],
            skills: [
              {
                skillName: "Product design",
                normalizedName: "product design",
                category: "other",
                proficiency: "proficient",
                yearsExperience: null,
                evidence: "",
              },
            ],
          }
        : { ...emptyPassportState },
    [fixtureScenario],
  );
  const fixtureStage: OnboardingStageId = fixtureScenario === "resumed" ? "experience" : "goals";
  const [state, setState] = useState<PassportState>(() => fixtureDraft);
  const [current, setCurrent] = useState<OnboardingStageId>(fixtureStage);
  const [loading, setLoading] = useState(!fixture);
  const [canAutosave, setCanAutosave] = useState(fixture);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>(
    fixtureScenario === "saving"
      ? "saving"
      : fixtureScenario === "error" || fixtureScenario === "permission"
        ? "error"
        : fixture
          ? "saved"
          : "idle",
  );
  const [message, setMessage] = useState(
    fixtureScenario === "error"
      ? "Your latest answers were not saved. Retry before continuing."
      : fixtureScenario === "permission"
        ? "You do not have permission to open this Passport. No private details were shown."
        : fixtureScenario === "resumed"
          ? "Your server-saved answers were restored."
          : "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [returnToReview, setReturnToReview] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaves = useRef(new Set<Promise<boolean>>());
  const lastSaved = useRef<string | null>(fixture ? draftFingerprint(fixtureDraft, fixtureStage) : null);
  const started = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const activation = useMemo(() => calculateActivation(state), [state]);
  const completion = useMemo(() => calculateCompletion(state), [state]);
  const contradictions = useMemo(() => findContradictions(state), [state]);
  const flags = useMemo(() => pathwayFlags(state.selectedGoals), [state.selectedGoals]);
  const activeFocusPaths = useMemo(() => activePathways(state.selectedGoals), [state.selectedGoals]);
  const resolvedFocusPath = useMemo(
    () => resolveFocusPath(state.selectedGoals, state.focusPath),
    [state.focusPath, state.selectedGoals],
  );

  const recordEvent = useCallback(
    (eventType: AnalyticsEvent, stage: OnboardingStageId, detail?: string) => {
      if (fixture) return;
      void fetch("/api/passport/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType, stage, detail }),
      });
    },
    [fixture],
  );

  const persistDraft = useCallback(
    (nextState: PassportState, stage: OnboardingStageId) => {
      if (fixture) return true;
      setSaveState("saving");
      const pending = (async () => {
        try {
          const response = await fetch("/api/passport", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ state: nextState, currentSection: stage }),
          });
          if (!response.ok) throw new Error("save");
          lastSaved.current = draftFingerprint(nextState, stage);
          setSaveState("saved");
          return true;
        } catch {
          setSaveState("error");
          return false;
        }
      })();
      pendingSaves.current.add(pending);
      void pending.finally(() => pendingSaves.current.delete(pending));
      return pending;
    },
    [fixture],
  );

  useEffect(() => {
    if (fixture) return;
    fetch("/api/passport")
      .then(async (response) => {
        if (!response.ok) throw new Error("resume");
        return response.json();
      })
      .then((data) => {
        const nextStage = mapLegacySectionToStage(data.progress?.current_section);
        const restoredState = data.state ?? emptyPassportState;
        lastSaved.current = draftFingerprint(restoredState, nextStage);
        setState(restoredState);
        setCurrent(nextStage);
        started.current = Boolean(data.progress?.revision);
        if (data.progress?.revision && data.progress?.completion !== 100)
          recordEvent("onboarding_resumed", nextStage);
        recordEvent("onboarding_stage_viewed", nextStage);
        setCanAutosave(true);
        setSaveState("saved");
      })
      .catch(() => {
        setCanAutosave(false);
        setMessage("We could not load your latest server draft. Retry before entering information.");
        setSaveState("error");
      })
      .finally(() => setLoading(false));
  }, [fixture, loadAttempt, recordEvent]);

  useEffect(() => {
    if (fixture || loading || !canAutosave) return;
    if (lastSaved.current === draftFingerprint(state, current)) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistDraft(state, current), 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [canAutosave, current, fixture, loading, persistDraft, state]);

  function retryLoad() {
    setLoading(true);
    setMessage("");
    setSaveState("idle");
    setLoadAttempt((value) => value + 1);
  }

  function update(patch: Partial<PassportState>) {
    if (!started.current) {
      started.current = true;
      recordEvent("onboarding_started", current);
    }
    setState((value) => {
      const next = { ...value, ...patch };
      if (patch.selectedGoals) next.focusPath = resolveFocusPath(patch.selectedGoals, next.focusPath);
      return next;
    });
    setErrors({});
    setMessage("");
    if (saveState === "error") setSaveState("idle");
  }

  function changeStage(next: OnboardingStageId) {
    setCurrent(next);
    setErrors({});
    setMessage("");
    recordEvent("onboarding_stage_viewed", next);
    if (next === "experience" && activeFocusPaths.length > 1 && !resolvedFocusPath)
      recordEvent("onboarding_focus_path_viewed", next, "selection");
    requestAnimationFrame(() => headingRef.current?.focus());
    if (typeof window !== "undefined" && !window.navigator.userAgent.includes("jsdom"))
      window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateStage(stage: OnboardingStageId) {
    const next: Record<string, string> = {};
    const education = state.education[0];
    const employment = state.employment[0];
    const trade = state.trade[0];
    if (stage === "goals") {
      if (!state.selectedGoals.length) next.goals = "Choose at least one goal.";
      if (!state.destinations.length && !state.openToOtherDestinations)
        next.destinations = "Choose a destination or select Open to suitable destinations.";
    }
    if (stage === "background") {
      if (!state.citizenshipCountry.trim()) next.citizenship = "Choose your country of citizenship.";
      if (!state.residenceCountry.trim()) next.residence = "Choose your current country of residence.";
    }
    if (stage === "experience") {
      if (activeFocusPaths.length > 1 && !resolvedFocusPath)
        next.focusPath = "Choose a path to personalise, or choose the exploring option.";
      if (resolvedFocusPath === "academic" && !education?.qualificationLevel.trim())
        next.qualification = "Add your highest relevant qualification.";
      if (resolvedFocusPath === "academic" && !education?.fieldOfStudy.trim())
        next.field = "Add your course or academic field.";
      if (resolvedFocusPath === "professional" && !employment?.jobTitle.trim())
        next.occupation = "Add your current or recent occupation.";
      if (resolvedFocusPath === "professional" && !employment?.employmentType.trim())
        next.employmentStatus = "Choose your current employment status.";
      if (resolvedFocusPath === "professional" && !employment?.startDate.trim())
        next.experience = "Add the year you started working in this field.";
      if (resolvedFocusPath === "professional" && !state.skills.some((item) => item.skillName.trim()))
        next.skills = "Add at least one core skill.";
      if (resolvedFocusPath === "trade" && !trade?.tradeOrOccupation.trim())
        next.trade = "Add your trade or occupation.";
      if (resolvedFocusPath === "trade" && trade?.practicalYears == null)
        next.tradeYears = "Choose your practical experience.";
      if (resolvedFocusPath === "trade" && !trade?.tradeCertification.trim())
        next.tradeCertification = "Choose a certification status, including unknown or not held.";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      setMessage("Review the required fields before continuing.");
      requestAnimationFrame(() => summaryRef.current?.focus());
      return false;
    }
    return true;
  }

  async function goNext() {
    if (!validateStage(current)) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await Promise.all(pendingSaves.current);
    if (!(await persistDraft(state, current))) {
      setMessage("Your latest answers were not saved. Retry before continuing.");
      return;
    }
    recordEvent("onboarding_stage_completed", current);
    if (returnToReview && current !== "review") {
      setReturnToReview(false);
      changeStage("review");
      return;
    }
    const next = onboardingStageIds[stageNumber(current)];
    if (next) changeStage(next);
  }

  function goBack() {
    const previous = onboardingStageIds[stageNumber(current) - 2];
    if (previous) changeStage(previous);
  }

  function editFromReview(stage: Exclude<OnboardingStageId, "review">, detail: string) {
    setReturnToReview(true);
    recordEvent("review_edit_requested", stage, detail);
    changeStage(stage);
  }

  function defer(detail: string) {
    recordEvent("optional_field_deferred", current, detail);
    setMessage("That optional detail can be added later from your Passport.");
  }

  function selectFocusPath(focusPath: OnboardingFocusPath) {
    const previous = state.focusPath;
    update({ focusPath });
    if (focusPath === "exploring") recordEvent("onboarding_exploring_selected", "experience", "exploring");
    else
      recordEvent(
        previous && previous !== focusPath
          ? "onboarding_focus_path_changed"
          : "onboarding_focus_path_selected",
        "experience",
        focusPath,
      );
    if (focusPath !== "exploring")
      activeFocusPaths
        .filter((path) => path !== focusPath)
        .forEach((path) => recordEvent("onboarding_deferred_path", "experience", path));
  }

  async function confirm() {
    const currentActivation = calculateActivation(state);
    if (contradictions.length || !currentActivation.complete) {
      setMessage(
        contradictions.length
          ? "Resolve the highlighted contradictions before confirming."
          : "Complete the minimum activation fields before confirming.",
      );
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (fixture) {
      setMessage("Your details are ready for initial matching. No CV or document is required.");
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    await Promise.all(pendingSaves.current);
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
    setMessage("Your Passport is confirmed. Finding the right next step…");
    window.location.assign(afterConfirmHref);
  }

  async function saveAndLeave() {
    if (fixture) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await Promise.all(pendingSaves.current);
    recordEvent("onboarding_stage_abandoned", current);
    if (!(await persistDraft(state, current))) {
      setMessage("We could not save this stage. Retry before leaving.");
      return;
    }
    await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" } });
    window.location.assign("/login?resume=1");
  }

  if (loading)
    return (
      <main className="passport-page">
        <section className="passport-loading ui-card" aria-live="polite">
          <p className="card-eyebrow">Opportunity Passport</p>
          <h1>Restoring your path…</h1>
          <p>We’re bringing back your latest server-saved stage.</p>
        </section>
      </main>
    );

  const currentIndex = stageNumber(current) - 1;
  return (
    <main className="passport-page" id="main-content">
      <header className="passport-header">
        <div>
          <p className="card-eyebrow">WAYFOUND · {enrichment ? "YOUR PASSPORT" : "QUICK START"}</p>
          <h1>
            {enrichment
              ? "Improve the Passport behind your opportunities."
              : "Find useful opportunities in a few focused steps."}
          </h1>
          <p>
            {enrichment
              ? "Review confirmed details and add useful context gradually."
              : "Confirm the essentials now. Build the rest of your Passport gradually after activation."}
          </p>
        </div>
        <button className="passport-exit" onClick={saveAndLeave} type="button">
          {fixture ? "Preview mode" : "Save and finish later"}
        </button>
      </header>
      <div className="passport-layout">
        <aside className="passport-progress" aria-label="Onboarding progress">
          <div className="passport-stage-summary">
            <span>Onboarding progress</span>
            <strong>Stage {currentIndex + 1} of 4</strong>
            <ProgressIndicator label="Onboarding progress" value={(currentIndex + 1) * 25} />
          </div>
          <nav aria-label="Four onboarding stages">
            {onboardingStages.map((stage, index) => (
              <button
                aria-current={stage.id === current ? "step" : undefined}
                className={stage.id === current ? "is-current" : index < currentIndex ? "is-complete" : ""}
                key={stage.id}
                onClick={() => {
                  if (index <= currentIndex) changeStage(stage.id);
                }}
                type="button"
              >
                <span>{index < currentIndex ? "✓" : index + 1}</span>
                {stage.label}
                <b>{index < currentIndex ? "Complete" : stage.id === current ? "Current" : "Next"}</b>
              </button>
            ))}
          </nav>
          <div className="passport-score">
            <span>Passport readiness</span>
            <strong>{completion.overall}%</strong>
            <ProgressIndicator label="Passport readiness" value={completion.overall} />
            <small>Improve this later for stronger matching and applications.</small>
          </div>
          <div className={`passport-save-status is-${saveState}`} role="status">
            {saveState === "saving"
              ? "Saving to your account…"
              : saveState === "error"
                ? "Save failed. Your server draft is unchanged."
                : "Saved to your account"}
            {saveState === "error" ? (
              <button
                onClick={() => (canAutosave ? void persistDraft(state, current) : retryLoad())}
                type="button"
              >
                {canAutosave ? "Retry save" : "Retry loading draft"}
              </button>
            ) : null}
          </div>
        </aside>
        <section className="passport-content" aria-labelledby="passport-stage-title">
          <div className="passport-step-heading">
            <span>Stage {currentIndex + 1} of 4</span>
            <h2 id="passport-stage-title" ref={headingRef} tabIndex={-1}>
              {onboardingStages[currentIndex]?.label}
            </h2>
            <p>{onboardingStages[currentIndex]?.description}</p>
          </div>
          {message ? (
            <div
              className={saveState === "error" || Object.keys(errors).length ? "auth-error" : "auth-success"}
              ref={summaryRef}
              role={Object.keys(errors).length ? "alert" : "status"}
              tabIndex={-1}
            >
              {message}
            </div>
          ) : null}
          {current === "goals" ? <GoalsStage errors={errors} state={state} update={update} /> : null}
          {current === "background" ? (
            <BackgroundStage errors={errors} state={state} update={update} />
          ) : null}
          {current === "experience" ? (
            <ExperienceStage
              activeFocusPaths={activeFocusPaths}
              defer={defer}
              errors={errors}
              flags={flags}
              focusPath={resolvedFocusPath}
              selectFocusPath={selectFocusPath}
              state={state}
              update={update}
            />
          ) : null}
          {current === "review" ? (
            <ReviewStage
              activation={activation}
              completion={completion}
              contradictions={contradictions}
              edit={editFromReview}
              focusPath={resolvedFocusPath}
              state={state}
            />
          ) : null}
          <div className="passport-actions">
            <Button disabled={currentIndex === 0} onClick={goBack} variant="quiet">
              Back
            </Button>
            {current === "review" ? (
              <Button disabled={!activation.complete || Boolean(contradictions.length)} onClick={confirm}>
                {enrichment ? "Save Passport changes" : "Confirm and find opportunities"}{" "}
                <span aria-hidden="true">→</span>
              </Button>
            ) : (
              <Button onClick={() => void goNext()}>
                {returnToReview ? "Return to review" : "Continue"} <span aria-hidden="true">→</span>
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function GoalsStage({
  errors,
  state,
  update,
}: {
  errors: Record<string, string>;
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  return (
    <div className="passport-section-stack">
      <fieldset aria-describedby={errors.goals ? "goals-error" : undefined}>
        <legend>
          What would you like to pursue? <span aria-hidden="true">*</span>
        </legend>
        <p className="passport-hint">Select one or more. Shared questions will only be asked once.</p>
        <div className="passport-goals">
          {goalCatalog.map((goal) => {
            const checked = state.selectedGoals.includes(goal.id);
            return (
              <button
                aria-pressed={checked}
                className={`passport-goal ${checked ? "is-selected" : ""}`}
                key={goal.id}
                onClick={() =>
                  update({
                    selectedGoals: checked
                      ? state.selectedGoals.filter((item) => item !== goal.id)
                      : [...state.selectedGoals, goal.id],
                  })
                }
                type="button"
              >
                <span className="passport-goal-mark">{checked ? "✓" : "+"}</span>
                <span>
                  <small>{goal.eyebrow}</small>
                  <strong>{goal.title}</strong>
                  <em>{goal.description}</em>
                </span>
              </button>
            );
          })}
        </div>
        {errors.goals ? (
          <p className="field-error" id="goals-error">
            {errors.goals}
          </p>
        ) : null}
      </fieldset>
      <fieldset aria-describedby={errors.destinations ? "destinations-error" : undefined}>
        <legend>
          Where are you interested in going? <span aria-hidden="true">*</span>
        </legend>
        <p className="passport-hint">Pick a few preferences, or stay open. You can change these later.</p>
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
        <Checkbox
          checked={state.openToOtherDestinations}
          label="Open to suitable destinations"
          onChange={(event) => update({ openToOtherDestinations: event.target.checked })}
        />
        {errors.destinations ? (
          <p className="field-error" id="destinations-error">
            {errors.destinations}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}

function BackgroundStage({
  errors,
  state,
  update,
}: {
  errors: Record<string, string>;
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  const originOptions = [["NG", "Nigeria"], ...countryOptions] as const;
  return (
    <div className="passport-section-stack">
      <section className="passport-question-card">
        <div className="passport-card-heading">
          <span>Everyone</span>
          <h3>Your starting point</h3>
        </div>
        <div className="passport-form-grid">
          <FormField error={errors.citizenship} label="Country of citizenship · Required">
            <Select
              value={state.citizenshipCountry}
              onChange={(event) => update({ citizenshipCountry: event.target.value })}
            >
              <option value="">Choose a country</option>
              {originOptions.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField error={errors.residence} label="Country of residence · Required">
            <Select
              value={state.residenceCountry}
              onChange={(event) => update({ residenceCountry: event.target.value })}
            >
              <option value="">Choose a country</option>
              {originOptions.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>
      <aside className="passport-later-card">
        <strong>Your route-specific questions come next</strong>
        <p>
          We only ask for the essentials for one route at a time. Your other selected goals stay active and
          can be personalised later from your Passport.
        </p>
      </aside>
    </div>
  );
}

function ExperienceStage({
  activeFocusPaths,
  defer,
  errors,
  flags,
  focusPath,
  selectFocusPath,
  state,
  update,
}: {
  activeFocusPaths: ReturnType<typeof activePathways>;
  defer: (detail: string) => void;
  errors: Record<string, string>;
  flags: ReturnType<typeof pathwayFlags>;
  focusPath: OnboardingFocusPath | null;
  selectFocusPath: (path: OnboardingFocusPath) => void;
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  const education = state.education[0] ?? educationBlank;
  const employment = state.employment[0] ?? employmentBlank;
  const trade = state.trade[0] ?? tradeBlank;
  const language = state.languages[0] ?? languageBlank;
  const certification = state.certifications[0] ?? certificationBlank;
  return (
    <div className="passport-section-stack">
      {activeFocusPaths.length > 1 ? (
        <FocusPathSelector
          activeFocusPaths={activeFocusPaths}
          error={errors.focusPath}
          focusPath={focusPath}
          onSelect={selectFocusPath}
        />
      ) : null}
      {focusPath === "academic" ? (
        <details className="passport-experience-card" open>
          <summary>
            <span>Study, scholarship and research</span>
            <strong>Academic foundation</strong>
          </summary>
          <div className="passport-form-grid">
            <FormField error={errors.qualification} label="Highest relevant qualification · Required">
              <Select
                value={education.qualificationLevel}
                onChange={(event) =>
                  update({
                    education: replaceFirst(state.education, educationBlank, {
                      qualificationLevel: event.target.value,
                    }),
                  })
                }
              >
                <option value="">Choose one</option>
                <option value="Secondary school">Secondary school</option>
                <option value="OND/NCE">OND or NCE</option>
                <option value="HND">HND</option>
                <option value="Bachelor's">Bachelor&apos;s degree</option>
                <option value="Master's">Master&apos;s degree</option>
                <option value="Doctorate">Doctorate</option>
                <option value="Other">Other</option>
              </Select>
            </FormField>
            <FormField error={errors.field} label="Course or academic field · Required">
              <Input
                placeholder="Computer science, public health…"
                value={education.fieldOfStudy}
                onChange={(event) =>
                  update({
                    education: replaceFirst(state.education, educationBlank, {
                      fieldOfStudy: event.target.value,
                    }),
                  })
                }
              />
            </FormField>
            <FormField label="Graduation status · Required">
              <Select
                value={education.graduationStatus}
                onChange={(event) =>
                  update({
                    education: replaceFirst(state.education, educationBlank, {
                      graduationStatus: event.target.value as typeof education.graduationStatus,
                    }),
                  })
                }
              >
                <option value="completed">Completed</option>
                <option value="currently_studying">Currently studying</option>
                <option value="awaiting_graduation">Awaiting graduation</option>
                <option value="result_pending">Result pending</option>
              </Select>
            </FormField>
            <FormField label="Grade or classification · Optional">
              <Input
                placeholder="First class, Distinction, 3.2/5…"
                value={education.gradeClassification}
                onChange={(event) =>
                  update({
                    education: replaceFirst(state.education, educationBlank, {
                      gradeClassification: event.target.value,
                    }),
                  })
                }
              />
            </FormField>
            <FormField label="English test status · Optional">
              <Select
                value={state.languages.length ? language.testStatus : ""}
                onChange={(event) =>
                  update({
                    languages: event.target.value
                      ? replaceFirst(state.languages, languageBlank, {
                          testStatus: event.target.value as typeof language.testStatus,
                        })
                      : [],
                  })
                }
              >
                <option value="">Add later</option>
                <option value="not_taken">Not taken</option>
                <option value="booked">Booked</option>
                <option value="taken">Taken, result pending</option>
                <option value="official">Official result available</option>
                <option value="practice_estimate">Practice estimate only</option>
              </Select>
            </FormField>
            {flags.research ? (
              <FormField label="Research experience · Optional">
                <TextArea
                  placeholder="A short summary is enough."
                  value={education.researchExperience}
                  onChange={(event) =>
                    update({
                      education: replaceFirst(state.education, educationBlank, {
                        researchExperience: event.target.value,
                      }),
                    })
                  }
                />
              </FormField>
            ) : null}
          </div>
          <button className="passport-defer" onClick={() => defer("academic_details")} type="button">
            Add optional academic details later
          </button>
        </details>
      ) : null}
      {focusPath === "professional" ? (
        <details className="passport-experience-card" open>
          <summary>
            <span>Professional and internship</span>
            <strong>Experience basis</strong>
          </summary>
          <div className="passport-form-grid">
            <FormField error={errors.occupation} label="Current or recent occupation · Required">
              <Input
                placeholder="Software engineer, accountant…"
                value={employment.jobTitle}
                onChange={(event) =>
                  update({
                    employment: replaceFirst(state.employment, employmentBlank, {
                      jobTitle: event.target.value,
                    }),
                  })
                }
              />
            </FormField>
            <FormField error={errors.employmentStatus} label="Employment status · Required">
              <Select
                value={employment.employmentType}
                onChange={(event) =>
                  update({
                    employment: replaceFirst(state.employment, employmentBlank, {
                      employmentType: event.target.value,
                    }),
                  })
                }
              >
                <option value="">Choose one</option>
                <option value="employed">Employed</option>
                <option value="self_employed">Self-employed</option>
                <option value="student">Student</option>
                <option value="between_roles">Between roles</option>
                <option value="not_applicable">Not applicable</option>
              </Select>
            </FormField>
            <FormField
              error={errors.experience}
              hint="An approximate year is enough for initial ranking."
              label="Year you started in this field · Required"
            >
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder="2020"
                value={employment.startDate}
                onChange={(event) =>
                  update({
                    employment: replaceFirst(state.employment, employmentBlank, {
                      startDate: event.target.value.replace(/[^0-9]/g, "").slice(0, 4),
                    }),
                  })
                }
              />
            </FormField>
            <FormField label="Professional credential status · Optional">
              <Select
                value={state.certifications.length ? certification.credentialStatus : ""}
                onChange={(event) =>
                  update({
                    certifications: event.target.value
                      ? replaceFirst(state.certifications, certificationBlank, {
                          credentialStatus: event.target.value as typeof certification.credentialStatus,
                        })
                      : [],
                  })
                }
              >
                <option value="">Add later / not applicable</option>
                <option value="active">Current</option>
                <option value="pending">I don&apos;t know / in progress</option>
                <option value="unverified">Not held</option>
                <option value="expired">Expired</option>
              </Select>
            </FormField>
          </div>
        </details>
      ) : null}
      {focusPath === "trade" ? (
        <details className="passport-experience-card" open>
          <summary>
            <span>Skilled and trade work</span>
            <strong>Practical readiness</strong>
          </summary>
          <div className="passport-form-grid">
            <FormField error={errors.trade} label="Trade or occupation · Required">
              <Input
                placeholder="Electrician, welder, chef…"
                value={trade.tradeOrOccupation}
                onChange={(event) =>
                  update({
                    trade: replaceFirst(state.trade, tradeBlank, { tradeOrOccupation: event.target.value }),
                  })
                }
              />
            </FormField>
            <FormField error={errors.tradeYears} label="Practical years of experience · Required">
              <Select
                value={trade.practicalYears == null ? "" : String(trade.practicalYears)}
                onChange={(event) =>
                  update({
                    trade: replaceFirst(state.trade, tradeBlank, {
                      practicalYears: event.target.value === "" ? null : Number(event.target.value),
                    }),
                  })
                }
              >
                <option value="">Choose one</option>
                <option value="0">Less than 1 year</option>
                <option value="1">1–2 years</option>
                <option value="3">3–5 years</option>
                <option value="6">6–10 years</option>
                <option value="11">More than 10 years</option>
              </Select>
            </FormField>
            <FormField error={errors.tradeCertification} label="Trade certification status · Required">
              <Select
                value={trade.tradeCertification}
                onChange={(event) =>
                  update({
                    trade: replaceFirst(state.trade, tradeBlank, { tradeCertification: event.target.value }),
                  })
                }
              >
                <option value="">Choose one</option>
                <option value="held">Certificate held</option>
                <option value="not_held">Not held</option>
                <option value="unknown">I don&apos;t know</option>
                <option value="not_applicable">Not applicable</option>
              </Select>
            </FormField>
            <FormField label="Licence or registration status · Required">
              <Select
                value={trade.licensingStatus}
                onChange={(event) =>
                  update({
                    trade: replaceFirst(state.trade, tradeBlank, {
                      licensingStatus: event.target.value as typeof trade.licensingStatus,
                    }),
                  })
                }
              >
                <option value="not_checked">I don&apos;t know / not checked</option>
                <option value="licensed">Licensed or registered</option>
                <option value="in_progress">In progress</option>
                <option value="not_applicable">Not applicable</option>
              </Select>
            </FormField>
          </div>
          <p className="passport-hint">
            Requirements differ by occupation and destination. This answer never creates a universal
            eligibility claim.
          </p>
        </details>
      ) : null}
      {focusPath === "professional" ? (
        <SkillsEditor error={errors.skills} state={state} update={update} />
      ) : null}
      {focusPath === "exploring" ? (
        <section className="passport-exploring-card" aria-live="polite">
          <span>Broad discovery first</span>
          <h3>We’ll show verified opportunities across your selected routes.</h3>
          <p>
            Your Passport will keep missing route details as unknown. Choose a path later to unlock tailored
            matches when your confirmed information supports one.
          </p>
        </section>
      ) : null}
      <aside className="passport-later-card">
        <strong>Continue in your Passport after onboarding</strong>
        <p>
          Full histories, publications, awards, documents, CV upload, detailed scores, licences and references
          are intentionally deferred.
        </p>
        <button className="passport-defer" onClick={() => defer("passport_enrichment")} type="button">
          I’ll add these later
        </button>
      </aside>
    </div>
  );
}

function FocusPathSelector({
  activeFocusPaths,
  error,
  focusPath,
  onSelect,
}: {
  activeFocusPaths: ReturnType<typeof activePathways>;
  error?: string;
  focusPath: OnboardingFocusPath | null;
  onSelect: (path: OnboardingFocusPath) => void;
}) {
  const choices: OnboardingFocusPath[] = [...activeFocusPaths, "exploring"];
  return (
    <section
      aria-describedby={error ? "focus-path-error" : undefined}
      aria-labelledby="focus-path-heading"
      className="passport-focus-selector"
    >
      <div className="passport-card-heading">
        <span>One route at a time</span>
        <h3 id="focus-path-heading">Which path would you like to personalise first?</h3>
      </div>
      <p>
        We’ll personalise this path now. You can add details for your other goals later from your Passport.
      </p>
      <div aria-label="Choose a path to personalise" className="passport-focus-options" role="group">
        {choices.map((path) => {
          const selected = focusPath === path;
          const copy = focusPathCopy[path];
          return (
            <button
              aria-pressed={selected}
              className={`passport-focus-option ${selected ? "is-selected" : ""}`}
              key={path}
              onClick={() => onSelect(path)}
              type="button"
            >
              <strong>{copy.title}</strong>
              <span>{copy.description}</span>
              <b>{selected ? "Selected" : "Choose"}</b>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="field-error" id="focus-path-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SkillsEditor({
  error,
  state,
  update,
}: {
  error?: string;
  state: PassportState;
  update: (patch: Partial<PassportState>) => void;
}) {
  const [skill, setSkill] = useState("");
  function add() {
    const value = skill.trim();
    const normalized = value.toLocaleLowerCase().replace(/\s+/g, " ");
    if (!value || state.skills.some((item) => item.normalizedName === normalized)) return;
    update({
      skills: [
        ...state.skills,
        {
          skillName: value,
          normalizedName: normalized,
          category: "other",
          proficiency: "developing",
          yearsExperience: null,
          evidence: "",
        },
      ],
    });
    setSkill("");
  }
  return (
    <section className="passport-question-card">
      <div className="passport-card-heading">
        <span>Shared across your work goals</span>
        <h3>Core skills</h3>
      </div>
      <div className="passport-inline-add">
        <FormField error={error} label="Add at least one skill · Required">
          <Input
            placeholder="Project management, welding, Excel…"
            value={skill}
            onChange={(event) => setSkill(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
        </FormField>
        <Button onClick={add} type="button" variant="secondary">
          Add skill
        </Button>
      </div>
      <div className="passport-chip-list" aria-label="Selected skills">
        {state.skills.map((item, index) => (
          <span key={`${item.normalizedName}-${index}`}>
            {item.skillName}
            <button
              aria-label={`Remove ${item.skillName}`}
              onClick={() => update({ skills: state.skills.filter((_, itemIndex) => itemIndex !== index) })}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}

function ReviewStage({
  activation,
  completion,
  contradictions,
  edit,
  focusPath,
  state,
}: {
  activation: ReturnType<typeof calculateActivation>;
  completion: ReturnType<typeof calculateCompletion>;
  contradictions: string[];
  edit: (stage: Exclude<OnboardingStageId, "review">, detail: string) => void;
  focusPath: OnboardingFocusPath | null;
  state: PassportState;
}) {
  const education = state.education[0];
  const employment = state.employment[0];
  const trade = state.trade[0];
  const countryName = (code: string) => countryOptions.find(([value]) => value === code)?.[1] ?? code;
  const deferred = [
    !education?.institution && "Full academic history",
    !employment?.employer && "Full employment history",
    !state.documents.length && "Document readiness and uploads",
    !state.certifications.length && "Detailed certifications and licences",
    !state.languages.length && "Language-test details",
  ].filter(Boolean) as string[];
  const deferredPaths = activePathways(state.selectedGoals).filter(
    (path) => focusPath === "exploring" || path !== focusPath,
  );
  return (
    <div className="passport-review">
      <div className="passport-activation-status">
        <span>
          {activation.complete ? "Ready for initial matching" : `${activation.overall}% activation complete`}
        </span>
        <strong>Passport {completion.overall}% complete</strong>
        <p>
          You do not need a 100% Passport to see opportunities. Missing facts remain unknown, never failed.
        </p>
      </div>
      <ReviewGroup title="Goals and destinations" onEdit={() => edit("goals", "goals_destinations")}>
        <p>
          {state.selectedGoals
            .map((goal) => goalCatalog.find((item) => item.id === goal)?.title)
            .join(", ") || "Not added"}
        </p>
        <p>
          {state.destinations.map(countryName).join(", ") || "No fixed destinations"}
          {state.openToOtherDestinations ? " · Open to suitable destinations" : ""}
        </p>
      </ReviewGroup>
      <ReviewGroup title="Background" onEdit={() => edit("background", "background")}>
        <p>
          Citizenship: {state.citizenshipCountry || "Unknown"} · Residence:{" "}
          {state.residenceCountry || "Unknown"}
        </p>
      </ReviewGroup>
      <ReviewGroup title="Personalisation focus" onEdit={() => edit("experience", "experience")}>
        {focusPath === "exploring" ? (
          <p>
            Exploring all selected routes first. WAYFOUND will show broader verified opportunities, not
            fabricated match scores.
          </p>
        ) : focusPath ? (
          <p>
            Personalising: {focusPathCopy[focusPath].title}. Other selected routes remain active for broader
            discovery.
          </p>
        ) : (
          <p>Choose a route to personalise before confirming.</p>
        )}
      </ReviewGroup>
      {education ? (
        <ReviewGroup title="Education" onEdit={() => edit("experience", "experience")}>
          <p>
            {education.qualificationLevel || "Qualification unknown"} ·{" "}
            {education.fieldOfStudy || "Field unknown"} · {education.graduationStatus.replaceAll("_", " ")}
          </p>
        </ReviewGroup>
      ) : null}
      {employment || trade ? (
        <ReviewGroup
          title="Professional or trade experience"
          onEdit={() =>
            edit(
              employment?.startDate || trade?.practicalYears != null ? "experience" : "background",
              "experience",
            )
          }
        >
          {employment ? (
            <p>
              {employment.jobTitle || "Occupation unknown"} ·{" "}
              {employment.employmentType.replaceAll("_", " ") || "Status unknown"}
              {employment.startDate ? ` · since ${employment.startDate}` : ""}
            </p>
          ) : null}
          {trade ? (
            <p>
              {trade.tradeOrOccupation || "Trade unknown"} · {trade.practicalYears ?? "Unknown"} practical
              years · certificate {trade.tradeCertification || "unknown"} · licence{" "}
              {trade.licensingStatus.replaceAll("_", " ")}
            </p>
          ) : null}
        </ReviewGroup>
      ) : null}
      <ReviewGroup title="Skills and credentials" onEdit={() => edit("experience", "experience")}>
        <p>Skills: {state.skills.map((item) => item.skillName).join(", ") || "None added"}</p>
        <p>
          Professional credentials: {state.certifications.length ? state.certifications.length : "Add later"}
        </p>
      </ReviewGroup>
      <section className="passport-review-group is-deferred">
        <div>
          <h3>Information deferred until later</h3>
          <span>Optional for activation</span>
        </div>
        <ul>
          {deferred.length ? (
            deferred.map((item) => <li key={item}>{item}</li>)
          ) : (
            <li>You can still add richer evidence later.</li>
          )}
        </ul>
      </section>
      {deferredPaths.length ? (
        <section className="passport-review-group is-deferred">
          <div>
            <h3>Active routes to personalise later</h3>
            <span>Still active for broader discovery</span>
          </div>
          <ul>
            {deferredPaths.map((path) => (
              <li key={path}>
                Explore {focusPathCopy[path].title.toLocaleLowerCase()} opportunities — complete this path to
                see your match.
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!activation.complete ? (
        <div className="passport-missing">
          <strong>Required before confirmation</strong>
          <ul>
            {activation.missing.map((item) => (
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
      <p className="passport-confirm-note">
        WAYFOUND will use this confirmed information to rank real opportunities. Confirmation creates or
        reuses an immutable Passport snapshot; equivalent details are never duplicated.
      </p>
    </div>
  );
}

function ReviewGroup({
  children,
  onEdit,
  title,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  title: string;
}) {
  return (
    <section className="passport-review-group">
      <div>
        <h3>{title}</h3>
        <button onClick={onEdit} type="button">
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}
