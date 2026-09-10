import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApplicationTracker, DocumentLibrary } from "@/features/applications/application-tracker";
import { phase9Applications, phase9Documents } from "@/features/applications/fixture";

describe("Phase 9 preparation surfaces", () => {
  it("communicates private document storage and mobile-compatible upload choices", () => {
    render(<DocumentLibrary initial={phase9Documents} />);
    expect(screen.getByRole("heading", { name: "Your document library" })).toBeVisible();
    expect(screen.getByText(/up to 10 MB/i)).toBeVisible();
    expect(screen.getByText("Private")).toBeVisible();
  });
  it("shows an honest application workspace tracker", () => {
    render(<ApplicationTracker initial={phase9Applications} />);
    expect(screen.getByText("Global Technology Scholarship")).toBeVisible();
    expect(screen.getByText(/does not submit an application/i)).toBeVisible();
    expect(screen.getByLabelText(/Update status/i)).toBeVisible();
  });
  it("renders explicit recovery, loading and permission states", () => {
    const view = render(<DocumentLibrary fixtureState="interrupted" initial={phase9Documents} />);
    expect(screen.getByRole("heading", { name: "Upload recovery available" })).toBeVisible();
    view.rerender(<DocumentLibrary fixtureState="loading" initial={phase9Documents} />);
    expect(screen.getByRole("heading", { name: "Loading your files" })).toBeVisible();
    view.rerender(<ApplicationTracker fixtureState="permission" initial={phase9Applications} />);
    expect(screen.getByRole("heading", { name: "Private applications unavailable" })).toBeVisible();
  });
});
