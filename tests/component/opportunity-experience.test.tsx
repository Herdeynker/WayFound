import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpportunityCard, OpportunityDetail } from "@/features/opportunities/opportunity-experience";
import { phase8FixtureDetail, phase8FixtureFeed } from "@/features/opportunities/fixture";

describe("Phase 8 opportunity experience", () => {
  it("labels fit, readiness and sponsorship uncertainty honestly", () => {
    render(
      <OpportunityCard
        item={phase8FixtureFeed().items[1]}
        onDismiss={() => undefined}
        onSave={() => undefined}
      />,
    );
    expect(screen.getByText("Fit score")).toBeVisible();
    expect(screen.getByText(/Employer capability only/)).toBeVisible();
    expect(screen.getByText("more information needed")).toBeVisible();
  });
  it("renders the safe detail explanation and non-guarantee boundary", () => {
    render(<OpportunityDetail detail={phase8FixtureDetail("demo-professional")} />);
    expect(screen.getByRole("heading", { name: "Why this matches" })).toBeVisible();
    expect(screen.getByText(/does not guarantee eligibility/)).toBeVisible();
  });
});
