import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { FirstUseWalkthrough } from "@/features/dashboard/first-use-walkthrough";
import { GettingStartedChecklist } from "@/features/dashboard/getting-started-checklist";

describe("Phase 16 discovery presentation", () => {
  it("supports walkthrough next/back/skip controls", () => {
    render(<FirstUseWalkthrough fixture initial={{ version: "v1", completed: false, dismissed: false }} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Explore safely")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("derives checklist presentation separately from completion", () => {
    render(
      <GettingStartedChecklist
        fixture
        initial={{
          dismissed: false,
          collapsed: false,
          items: [
            { id: "goals", label: "Choose relocation goals", href: "/onboarding", complete: false },
            { id: "match", label: "Review your first match", href: "/opportunities", complete: true },
          ],
        }}
      />,
    );
    expect(screen.getByText("1 of 2 complete")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("Choose relocation goals")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("Choose relocation goals")).toBeInTheDocument();
  });
});
