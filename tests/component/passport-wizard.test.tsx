import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PassportWizard } from "@/features/passport/passport-wizard";
import { emptyPassportState } from "@/features/passport/model";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Opportunity Passport optimized onboarding", () => {
  it("shows four stages and blocks progress until the activation choices are present", async () => {
    const user = userEvent.setup();
    render(<PassportWizard fixture />);

    expect(screen.getByText("Stage 1 of 4", { selector: "strong" })).toBeInTheDocument();
    const stageNavigation = screen.getByRole("navigation", { name: /four onboarding stages/i });
    expect(stageNavigation.querySelectorAll("button")).toHaveLength(4);
    for (const label of ["Goals", "Background", "Experience", "Review"])
      expect(stageNavigation).toHaveTextContent(label);

    await user.click(screen.getByRole("button", { name: /^continue/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/review the required fields/i);
    expect(screen.getByText(/choose at least one goal/i)).toBeInTheDocument();
    expect(screen.getByText(/choose a destination/i)).toBeInTheDocument();
  });

  it("completes the concise study pathway without requiring deferred Passport enrichment", async () => {
    const user = userEvent.setup();
    render(<PassportWizard fixture />);

    await user.click(screen.getByRole("button", { name: /study and scholarship funding/i }));
    await user.click(screen.getByLabelText("Canada"));
    await user.click(screen.getByRole("button", { name: /^continue/i }));
    expect(screen.getByRole("heading", { name: "Background" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/highest relevant qualification/i), "Bachelor's");
    await user.type(screen.getByLabelText(/course or academic field/i), "Computer science");
    await user.click(screen.getByRole("button", { name: /^continue/i }));
    expect(screen.getByRole("heading", { name: "Experience" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^continue/i }));
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText(/ready for initial matching/i)).toBeInTheDocument();
    expect(screen.getByText(/information deferred until later/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm and find opportunities/i })).toBeEnabled();

    const education = screen.getByRole("heading", { name: "Education" }).closest("section");
    expect(education).not.toBeNull();
    await user.click(within(education!).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Background" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /return to review/i })).toBeInTheDocument();
  });

  it("renders the union of multi-goal questions once and preserves explicit trade answers", async () => {
    const user = userEvent.setup();
    render(<PassportWizard fixture />);

    await user.click(screen.getByRole("button", { name: /professional jobs with sponsorship/i }));
    await user.click(screen.getByRole("button", { name: /skilled or trade work with sponsorship/i }));
    await user.click(screen.getByLabelText(/open to suitable destinations/i));
    await user.click(screen.getByRole("button", { name: /^continue/i }));

    await user.type(screen.getByLabelText(/current or recent occupation/i), "Accountant");
    await user.selectOptions(screen.getByLabelText(/employment status/i), "employed");
    await user.type(screen.getByLabelText(/trade or occupation/i), "Welder");
    await user.click(screen.getByRole("button", { name: /^continue/i }));

    expect(screen.getAllByText("Core skills")).toHaveLength(1);
    await user.type(screen.getByLabelText(/year you started/i), "2020");
    await user.selectOptions(screen.getByLabelText(/practical years/i), "0");
    await user.selectOptions(screen.getByLabelText(/trade certification status/i), "unknown");
    await user.type(screen.getByLabelText(/add at least one skill/i), "Excel");
    await user.click(screen.getByRole("button", { name: /add skill/i }));
    await user.click(screen.getByRole("button", { name: /^continue/i }));

    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText(/0 practical years/i)).toBeInTheDocument();
    expect(screen.getByText(/skills: excel/i)).toBeInTheDocument();
  });

  it("resumes a legacy draft and reports autosave failure until retry succeeds", async () => {
    const restoredState = {
      ...emptyPassportState,
      selectedGoals: ["study_funding" as const],
      destinations: ["CA"],
      education: [
        {
          institution: "",
          country: "",
          qualificationLevel: "Bachelor's",
          fieldOfStudy: "Computer science",
          startDate: "",
          completionDate: "",
          graduationStatus: "completed" as const,
          gradeClassification: "",
          gpaValue: null,
          gpaScale: null,
          resultPending: false,
          expectedGraduationDate: "",
          transcriptAvailable: null,
          researchExperience: "",
          publications: "",
          academicAwards: "",
        },
      ],
    };
    let saveAttempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/passport/events")) return Response.json({ ok: true });
        if (init?.method === "PUT") {
          saveAttempts += 1;
          return saveAttempts === 1
            ? Response.json({ error: "temporary" }, { status: 503 })
            : Response.json({ ok: true });
        }
        return Response.json({
          state: restoredState,
          progress: { current_section: "academic", revision: 7, completion: 50 },
        });
      }),
    );
    const user = userEvent.setup();
    render(<PassportWizard />);

    expect(await screen.findByRole("heading", { name: "Experience" })).toBeInTheDocument();
    expect(screen.getByText(/passport readiness/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/grade or classification/i), "First class");
    expect(await screen.findByRole("button", { name: /retry save/i }, { timeout: 2500 })).toBeInTheDocument();
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry save/i }));
    await waitFor(() => expect(screen.getByText("Saved to your account")).toBeInTheDocument());
    expect(saveAttempts).toBe(2);
  });
});
