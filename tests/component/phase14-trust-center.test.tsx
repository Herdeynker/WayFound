import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrustCenter, type TrustCenterState } from "@/features/launch/trust-center";

describe("Phase 14 trust center", () => {
  afterEach(cleanup);

  it("explains privacy, product boundaries, scanning and policy access", () => {
    render(<TrustCenter policyVersion="2026-09-12.v1" scannerConfigured />);
    expect(screen.getByRole("heading", { name: "Your information stays under your control" })).toBeVisible();
    expect(screen.getByText("No automatic applications")).toBeVisible();
    expect(screen.getByRole("link", { name: /Read policies/ })).toHaveAttribute("href", "/legal");
  });

  for (const [state, expected] of [
    ["first-use", "Start with your privacy choices"],
    ["success", "Your choices are saved"],
    ["error", "Privacy status could not be loaded"],
    ["interrupted", "The operation was interrupted"],
    ["stale", "This status may be out of date"],
    ["permission", "Permission required"],
    ["provider-disabled", "Document scanning is unavailable"],
  ] as Array<[TrustCenterState, string]>) {
    it(`renders the ${state} state without false success`, () => {
      render(
        <TrustCenter
          policyVersion="2026-09-12.v1"
          scannerConfigured={state !== "provider-disabled"}
          state={state}
        />,
      );
      expect(screen.getByText(expected)).toBeVisible();
    });
  }

  it("uses an honest loading state", () => {
    render(<TrustCenter policyVersion="2026-09-12.v1" scannerConfigured state="loading" />);
    expect(screen.getByRole("heading", { name: "Loading your privacy controls" })).toBeVisible();
  });

  it("offers a reachable retry action for interrupted work", () => {
    render(<TrustCenter policyVersion="2026-09-12.v1" scannerConfigured state="interrupted" />);
    expect(screen.getByRole("button", { name: "Retry securely" })).toBeEnabled();
  });
});
