import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoundationStatus } from "@/components/foundation-status";

describe("FoundationStatus", () => {
  it("communicates that the application foundation is ready and links to health", () => {
    render(<FoundationStatus />);
    expect(screen.getByRole("heading", { name: "Application foundation ready" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View service health" })).toHaveAttribute("href", "/health");
  });
});
