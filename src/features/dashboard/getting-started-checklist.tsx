"use client";

import Link from "next/link";
import React from "react";
import { useState } from "react";
import type { DashboardFixture } from "./dashboard-fixtures";

export function GettingStartedChecklist({
  initial,
  fixture = false,
}: {
  initial: DashboardFixture["checklist"];
  fixture?: boolean;
}) {
  const [state, setState] = useState(initial);
  const complete = state.items.filter((item) => item.complete).length;
  const persist = async (action: "collapse" | "expand" | "dismiss" | "reopen") => {
    if (!fixture)
      await fetch("/api/checklist", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
  };
  if (state.dismissed)
    return (
      <button
        className="checklist-reopen"
        onClick={() => {
          setState((value) => ({ ...value, dismissed: false }));
          void persist("reopen");
        }}
        type="button"
      >
        Reopen Getting Started
      </button>
    );
  return (
    <section
      aria-labelledby="getting-started-title"
      className={`getting-started ${state.collapsed ? "is-collapsed" : ""}`}
    >
      <div className="getting-started-header">
        <div>
          <p className="card-eyebrow">GETTING STARTED</p>
          <h2 id="getting-started-title">Your first steps</h2>
          <p>
            {complete} of {state.items.length} complete
          </p>
        </div>
        <div className="getting-started-actions">
          <button
            aria-expanded={!state.collapsed}
            className="text-button"
            onClick={() => {
              const collapsed = !state.collapsed;
              setState((value) => ({ ...value, collapsed }));
              void persist(collapsed ? "collapse" : "expand");
            }}
            type="button"
          >
            {state.collapsed ? "Expand" : "Collapse"}
          </button>
          <button
            aria-label="Dismiss Getting Started checklist"
            className="text-button"
            onClick={() => {
              setState((value) => ({ ...value, dismissed: true }));
              void persist("dismiss");
            }}
            type="button"
          >
            Dismiss
          </button>
        </div>
      </div>
      {!state.collapsed ? (
        <ol className="getting-started-list">
          {state.items.map((item) => (
            <li className={item.complete ? "is-complete" : ""} key={item.id}>
              <span aria-hidden="true">{item.complete ? "✓" : "○"}</span>
              <Link href={item.href as never}>{item.label}</Link>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
