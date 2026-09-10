import { describe, expect, it } from "vitest";
import { applicationTransitionAllowed, validateDocumentUpload } from "@/server/applications/model";

describe("Phase 9 document and application rules", () => {
  it("accepts only consistent file signatures, extensions and bounded sizes", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(
      validateDocumentUpload({ name: "passport.pdf", type: "application/pdf", size: pdf.length }, pdf)
        .checksum,
    ).toHaveLength(64);
    expect(() =>
      validateDocumentUpload({ name: "passport.pdf", type: "image/png", size: pdf.length }, pdf),
    ).toThrow(/signature/);
    expect(() =>
      validateDocumentUpload({ name: "passport.exe", type: "application/pdf", size: pdf.length }, pdf),
    ).toThrow(/extension/);
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    oversized.set(pdf);
    expect(() =>
      validateDocumentUpload(
        { name: "passport.pdf", type: "application/pdf", size: oversized.length },
        oversized,
      ),
    ).toThrow(/under 10 MB/);
  });
  it("allows only the canonical application lifecycle transitions", () => {
    expect(applicationTransitionAllowed("interested", "preparing")).toBe(true);
    expect(applicationTransitionAllowed("preparing", "submitted")).toBe(true);
    expect(applicationTransitionAllowed("submitted", "ready")).toBe(false);
    expect(applicationTransitionAllowed("accepted", "withdrawn")).toBe(false);
  });
});
