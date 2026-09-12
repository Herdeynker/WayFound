import { expect, test } from "@playwright/test";

test.describe("Phase 10 CV and application assistant", () => {
  test("completes the evidence-grounded writing journey", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop writing journey is covered once");
    await page.goto("/prepare/assistant");
    await expect(page.getByRole("heading", { name: /Turn your facts/ })).toBeVisible();
    await expect(page.getByText("No invented achievements")).toBeVisible();
    await page.getByRole("button", { name: "Create grounded draft" }).click();
    await expect(page.getByText(/Every paragraph is linked/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Export PDF" })).toHaveCount(0);
    await page.getByRole("button", { name: "Approve this revision" }).click();
    await expect(page.getByRole("link", { name: "Export PDF" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Export DOCX" })).toBeVisible();
  });

  test("supports CV review and mobile save/resume without overflow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical mobile journey uses 390×844");
    await page.goto("/prepare/assistant");
    await page.getByRole("button", { name: "CV review" }).click();
    await page
      .getByLabel("CV text")
      .fill(
        `Amara Example\nSummary\nSoftware professional\nExperience\n- Built accessible applications\nEducation\nBSc Computer Science\nSkills\nTypeScript ${"evidence ".repeat(20)}`,
      );
    await page.getByRole("button", { name: "Analyse this CV" }).click();
    await expect(page.getByText(/not an outcome probability/)).toBeVisible();
    await expect(page.getByText(/No Passport field will be changed/)).toBeVisible();
    await page.getByRole("button", { name: "Writing studio" }).click();
    await expect(page.getByRole("heading", { name: "Your recent drafts" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("exposes honest interruption, disabled and permission states", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical state review uses 390×844");
    await page.goto("/prepare/assistant?state=interrupted");
    await expect(page.getByRole("heading", { name: "Generation was interrupted" })).toBeVisible();
    await page.goto("/prepare/assistant?state=disabled");
    await expect(page.getByRole("heading", { name: "Writing provider not configured" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create grounded draft" })).toBeDisabled();
    await page.goto("/prepare/assistant?state=permission");
    await expect(page.getByRole("alert")).toContainText("No private facts were shown");
  });

  test("keeps the assistant keyboard-reachable and explicitly labelled", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical accessibility pass uses 390×844");
    await page.goto("/prepare/assistant?state=stale");
    await expect(page.getByRole("heading", { name: "Draft needs review" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Assistant tools" })).toBeVisible();
    await expect(page.getByLabel("Application", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Material", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Tone", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Word limit", { exact: true })).toBeVisible();
    const cvReview = page.getByRole("button", { name: "CV review" });
    await expect(cvReview).toBeEnabled();
    await cvReview.focus();
    await expect(cvReview).toBeFocused();
    await cvReview.click();
    await expect(page.getByLabel("CV text")).toBeVisible();
  });
});
