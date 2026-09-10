import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AssistantWorkspace } from "@/features/assistant/workspace";
import { phase10Application, phase10Facts, phase10Summary } from "@/features/assistant/fixture";

afterEach(cleanup);

describe("Phase 10 assistant workspace", () => {
  it("requires explicit facts, creates a reviewable draft and gates exports on approval", async () => {
    const user = userEvent.setup();
    render(
      <AssistantWorkspace
        applications={[phase10Application]}
        fixture
        initial={phase10Summary}
        sourceFacts={phase10Facts}
      />,
    );
    expect(screen.getByRole("heading", { name: /Turn your facts/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Export PDF" })).not.toBeInTheDocument();
    const facts = screen.getAllByRole("checkbox");
    for (const fact of facts) await user.click(fact);
    expect(screen.getByRole("button", { name: "Create grounded draft" })).toBeDisabled();
    await user.click(facts[0]);
    await user.click(screen.getByRole("button", { name: "Create grounded draft" }));
    expect(screen.getByText(/Every paragraph is linked/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve this revision" }));
    expect(screen.getByRole("link", { name: "Export PDF" })).toHaveAttribute(
      "href",
      expect.stringContaining("format=pdf"),
    );
    expect(screen.getByRole("link", { name: "Export DOCX" })).toBeInTheDocument();
  });

  it("analyses CV text without claiming probability or changing Passport data", async () => {
    const user = userEvent.setup();
    render(
      <AssistantWorkspace
        applications={[phase10Application]}
        fixture
        initial={phase10Summary}
        sourceFacts={phase10Facts}
      />,
    );
    await user.click(screen.getByRole("button", { name: "CV review" }));
    fireEvent.change(screen.getByLabelText("CV text"), {
      target: {
        value: `Amara Example\nSummary\nSoftware professional\nExperience\n- Built accessible applications\nEducation\nBSc Computer Science\nSkills\nTypeScript ${"evidence ".repeat(20)}`,
      },
    });
    await user.click(screen.getByRole("button", { name: "Analyse this CV" }));
    expect(screen.getByText(/CV alignment — not an outcome probability/)).toBeInTheDocument();
    expect(screen.getByText(/No Passport field will be changed/)).toBeInTheDocument();
  });

  it("shows honest disabled and permission states", () => {
    const { rerender } = render(
      <AssistantWorkspace
        applications={[phase10Application]}
        fixture
        initial={phase10Summary}
        sourceFacts={phase10Facts}
        state="disabled"
      />,
    );
    expect(screen.getByRole("heading", { name: "Writing provider not configured" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create grounded draft" })).toBeDisabled();
    rerender(
      <AssistantWorkspace
        applications={[]}
        fixture
        initial={phase10Summary}
        sourceFacts={phase10Facts}
        state="permission"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No private facts were shown");
  });

  it("requires explicit confirmation in production and accepts user-provided evidence", async () => {
    const user = userEvent.setup();
    render(
      <AssistantWorkspace
        applications={[phase10Application]}
        initial={phase10Summary}
        sourceFacts={phase10Facts}
      />,
    );
    expect(screen.getAllByRole("checkbox").every((item) => !(item as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole("button", { name: "Create grounded draft" })).toBeDisabled();
    await user.type(screen.getByLabelText("Evidence fact label"), "Verified leadership");
    await user.type(screen.getByLabelText("Evidence fact value"), "Led a community study group");
    await user.click(screen.getByRole("button", { name: "Add evidence fact" }));
    expect(screen.getByText("Led a community study group")).toBeInTheDocument();
    expect((screen.getAllByRole("checkbox").at(-1) as HTMLInputElement).checked).toBe(true);
  });
});
