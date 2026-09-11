import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { IeltsPractice } from "@/features/ielts/ielts-practice";
import { phase13Fixture } from "@/features/ielts/fixture";

afterEach(cleanup);

describe("Phase 13 IELTS practice", () => {
  it("shows setup, progress, official resources and the unofficial boundary", () => {
    render(<IeltsPractice fixture overview={phase13Fixture} />);
    expect(screen.getByRole("heading", { name: /Practice with a clearer route/ })).toBeVisible();
    expect(screen.getByText("Unofficial practice estimates")).toBeVisible();
    expect(screen.getByRole("link", { name: /IELTS preparation resources/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/ielts\.org/),
    );
    expect(screen.getByLabelText("Test type")).toHaveValue("academic");
  });

  it("saves first-use General Training setup honestly", async () => {
    const user = userEvent.setup();
    render(
      <IeltsPractice
        fixture
        overview={{ ...phase13Fixture, profile: null, attempts: [], feedback: [], studyPlan: null }}
        state="empty"
      />,
    );
    await user.selectOptions(screen.getByLabelText("Test type"), "general");
    await user.click(screen.getByRole("button", { name: "Save IELTS goal" }));
    expect(await screen.findByText(/IELTS route is saved/)).toBeVisible();
  });

  it("completes deterministic fixture reading and labels the estimate", async () => {
    const user = userEvent.setup();
    render(<IeltsPractice fixture overview={phase13Fixture} />);
    await user.click(screen.getByRole("button", { name: "reading" }));
    await user.click(screen.getByRole("button", { name: "Start timed diagnostic" }));
    const radios = screen.getAllByRole("radio");
    for (const index of [0, 3, 6, 9]) await user.click(radios[index]);
    await user.click(screen.getByRole("button", { name: "Score my answers" }));
    expect(await screen.findByText(/not an official IELTS score/)).toBeVisible();
  });

  it("renders writing feedback only after a sufficient response", async () => {
    const user = userEvent.setup();
    render(<IeltsPractice fixture overview={phase13Fixture} />);
    await user.click(screen.getByRole("button", { name: "writing" }));
    const response = screen.getByLabelText("Writing response");
    expect(screen.getByRole("button", { name: "Request estimated feedback" })).toBeDisabled();
    fireEvent.change(response, {
      target: {
        value:
          "This response explains the trend clearly and compares the two periods with relevant details. ".repeat(
            6,
          ),
      },
    });
    await user.click(screen.getByRole("button", { name: "Request estimated feedback" }));
    expect(await screen.findByText("Unofficial estimate")).toBeVisible();
  });

  it("reports microphone denial and offers file upload instead", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new Error("denied")) },
    });
    const user = userEvent.setup();
    render(<IeltsPractice fixture overview={phase13Fixture} />);
    await user.click(screen.getByRole("button", { name: "speaking" }));
    await user.click(screen.getByRole("button", { name: "Start microphone recording" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/permission was denied/);
    expect(screen.getByLabelText("Or choose audio")).toBeVisible();
  });

  it("does not simulate provider success when feedback is disabled", async () => {
    const user = userEvent.setup();
    render(
      <IeltsPractice fixture overview={{ ...phase13Fixture, providerConfigured: false }} state="disabled" />,
    );
    await user.click(screen.getByRole("button", { name: "writing" }));
    expect(screen.getByRole("heading", { name: /not configured/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Request estimated feedback" })).toBeDisabled();
  });

  it("renders loading, interruption, stale, completed and permission states semantically", async () => {
    const { rerender } = render(<IeltsPractice fixture overview={phase13Fixture} state="loading" />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    rerender(<IeltsPractice fixture overview={phase13Fixture} state="interrupted" />);
    expect(screen.getByRole("heading", { name: "Practice was interrupted" })).toBeVisible();
    rerender(<IeltsPractice fixture overview={phase13Fixture} state="stale" />);
    expect(screen.getByRole("heading", { name: /needs a refresh/ })).toBeVisible();
    rerender(<IeltsPractice fixture overview={phase13Fixture} state="completed" />);
    expect(screen.getByRole("heading", { name: "Diagnostic complete" })).toBeVisible();
    rerender(<IeltsPractice fixture overview={phase13Fixture} state="permission" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/No private response/);
    fireEvent.keyDown(screen.getByRole("link", { name: "Sign in securely" }), { key: "Tab" });
    await waitFor(() => expect(screen.getByRole("link", { name: "Sign in securely" })).toBeVisible());
  });
});
