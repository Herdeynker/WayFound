import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardShell } from "@/components/dashboard-shell";
import { DesktopRouteSignature, SidebarRouteSignature } from "@/components/route-signatures";
import { dashboardFixture } from "@/features/dashboard/dashboard-fixtures";

afterEach(() => cleanup());

describe("Phase 1 dashboard shell", () => {
  it("renders the approved greeting, route signatures and fixture content", () => {
    render(<DashboardShell />);

    expect(screen.getByRole("heading", { name: "Good morning, Amara" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Your next step is a bigger story." }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByRole("img", { name: "A brighter tomorrow. A wider you." }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("heading", { name: "Your Opportunity Path" })).toBeInTheDocument();
    expect(screen.getAllByText("Complete your profile")).toHaveLength(2);
    expect(screen.getAllByText("Deadline")).toHaveLength(dashboardFixture.opportunities.length);
    expect(screen.queryByText("Fixture deadline")).not.toBeInTheDocument();
    for (const opportunity of dashboardFixture.opportunities)
      expect(screen.getByText(opportunity.title)).toBeInTheDocument();
  });

  it("exposes active navigation semantics and labelled icon controls", () => {
    render(<DashboardShell />);

    expect(screen.getAllByRole("link", { name: "Home" })[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("button", { name: "Notifications" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Save/ })).toHaveLength(3);
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
  });
});

describe("route signature artwork", () => {
  it("keeps both exact brand captions in accessible SVGs", () => {
    render(
      <>
        <DesktopRouteSignature />
        <SidebarRouteSignature />
      </>,
    );
    expect(screen.getAllByRole("img", { name: "Your next step is a bigger story." })).toHaveLength(1);
    expect(screen.getAllByRole("img", { name: "A brighter tomorrow. A wider you." })).toHaveLength(1);
  });
});
