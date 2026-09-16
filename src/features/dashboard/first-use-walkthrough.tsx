"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

type Props = { fixture?: boolean; initial: { version: string; completed: boolean; dismissed: boolean } };
type Step = { target: string; title: string; copy: string; mobileTarget?: string };

const steps: Step[] = [
  {
    target: "#home",
    title: "Your home base",
    copy: "See your readiness, next action and strongest verified opportunities in one place.",
  },
  {
    target: "#sidebar-opportunities",
    mobileTarget: "#mobile-bottom-nav",
    title: "Explore safely",
    copy: "Browse verified opportunities, understand the fit, and keep broader discoveries clearly labelled.",
  },
  {
    target: "#account-menu-trigger",
    mobileTarget: "#mobile-account-trigger",
    title: "Stay in control",
    copy: "Manage your profile, billing, alerts and settings whenever you need them.",
  },
];

export function FirstUseWalkthrough({ fixture = false, initial }: Props) {
  const [open, setOpen] = useState(!initial.completed && !initial.dismissed);
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mobile, setMobile] = useState(false);
  const step = steps[index];

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void close("dismissed");
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button, a, [tabindex='0']");
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) previouslyFocused.current?.focus();
    const target = document.querySelector(mobile ? (step.mobileTarget ?? step.target) : step.target);
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (target instanceof HTMLElement && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    }
  }, [index, mobile, open, step]);

  useEffect(() => {
    const restart = () => {
      setIndex(0);
      setOpen(true);
      void persist("restarted");
    };
    window.addEventListener("wayfound:restart-tour", restart);
    return () => window.removeEventListener("wayfound:restart-tour", restart);
  }, []);

  const persist = async (action: "started" | "completed" | "dismissed" | "restarted") => {
    if (fixture) return;
    await fetch("/api/walkthrough", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: initial.version, action }),
    });
  };

  const close = async (action: "completed" | "dismissed") => {
    setOpen(false);
    await persist(action);
  };

  if (!open) return null;
  return (
    <div className="walkthrough-backdrop" role="presentation">
      <div
        aria-describedby="walkthrough-copy"
        aria-labelledby="walkthrough-title"
        aria-modal="true"
        className="walkthrough-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <p className="eyebrow">
          WAYFOUND TOUR · {index + 1} OF {steps.length}
        </p>
        <h2 id="walkthrough-title">{step.title}</h2>
        <p id="walkthrough-copy">{step.copy}</p>
        <div aria-label="Walkthrough progress" className="walkthrough-progress">
          {steps.map((item, itemIndex) => (
            <span className={itemIndex <= index ? "is-active" : ""} key={item.target} />
          ))}
        </div>
        <div className="walkthrough-actions">
          <button className="text-button" onClick={() => void close("dismissed")} type="button">
            Skip
          </button>
          {index > 0 ? (
            <Button onClick={() => setIndex((value) => value - 1)} variant="secondary">
              Back
            </Button>
          ) : null}
          {index < steps.length - 1 ? (
            <Button
              onClick={() => {
                setIndex((value) => value + 1);
                void persist("started");
              }}
              variant="teal"
            >
              Next
            </Button>
          ) : (
            <Button onClick={() => void close("completed")} variant="teal">
              Finish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RestartWalkthroughButton() {
  return (
    <button
      className="text-button"
      onClick={() => window.dispatchEvent(new Event("wayfound:restart-tour"))}
      type="button"
    >
      Restart product tour
    </button>
  );
}
