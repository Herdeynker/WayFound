import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PassportWizard } from "@/features/passport/passport-wizard";

afterEach(() => cleanup());

describe("Opportunity Passport wizard", () => {
  it("supports multi-goal selection and conditional sections", async () => {
    const user = userEvent.setup();
    render(<PassportWizard fixture />);
    await user.click(screen.getByRole("button", { name: /study and scholarship funding/i }));
    await user.click(screen.getByRole("button", { name: /skilled or trade work with sponsorship/i }));
    expect(screen.getByText(/Choose one or more directions/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save and continue/i }));
    expect(screen.getByRole("heading", { name: "About you" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save and continue/i }));
    expect(screen.getByRole("heading", { name: "Destinations" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save and continue/i }));
    expect(screen.getByRole("heading", { name: "Academic history" })).toBeInTheDocument();
  });
});
