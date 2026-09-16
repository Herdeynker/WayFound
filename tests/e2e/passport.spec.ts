import { expect, test, type Page } from "@playwright/test";

// Long mobile forms rely on browser scrolling; keep this journey serial so parallel
// workers cannot contend for the constrained production test server.
test.describe.configure({ mode: "serial" });

async function completeStudyActivation(page: Page) {
  await page.getByRole("button", { name: /study and scholarship funding/i }).click();
  await page.getByLabel("Canada").check();
  await page.getByRole("button", { name: /^continue/i }).click();
  await expect(page.getByRole("heading", { name: "Background" })).toBeVisible();
  await page.getByLabel(/highest relevant qualification/i).selectOption("Bachelor's");
  await page.getByLabel(/course or academic field/i).fill("Computer science");
  await page.getByRole("button", { name: /^continue/i }).click();
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
  await page.getByRole("button", { name: /^continue/i }).click();
}

test("optimized Passport uses four honest stages and permits deferred enrichment", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Goals" })).toBeVisible();
  await expect(page.getByText("Stage 1 of 4", { exact: true }).first()).toBeVisible();
  await completeStudyActivation(page);
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  await expect(page.getByText(/ready for initial matching/i)).toBeVisible();
  await expect(page.getByText(/information deferred until later/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /confirm and find opportunities/i })).toBeEnabled();
});

test("multi-goal Passport asks shared experience once", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /professional jobs with sponsorship/i }).click();
  await page.getByRole("button", { name: /skilled or trade work with sponsorship/i }).click();
  await page.getByLabel(/open to suitable destinations/i).check();
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByLabel(/current or recent occupation/i).fill("Accountant");
  await page.getByLabel(/employment status/i).selectOption("employed");
  await page.getByLabel(/trade or occupation/i).fill("Welder");
  await page.getByRole("button", { name: /^continue/i }).click();
  await expect(page.getByRole("heading", { name: "Core skills" })).toHaveCount(1);
  await page.getByLabel(/year you started/i).fill("2020");
  await page.getByLabel(/practical years/i).selectOption("0");
  await page.getByLabel(/trade certification status/i).selectOption("unknown");
  await page.getByLabel(/add at least one skill/i).fill("Excel");
  await page.getByRole("button", { name: /add skill/i }).click();
  await page.getByRole("button", { name: /^continue/i }).click();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  await expect(page.getByText(/0 practical years/i)).toBeVisible();
});

test("mobile onboarding has no horizontal overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "Mobile viewport assertion");
  await page.goto("/onboarding");
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
});

test("onboarding can be completed with keyboard controls and restores focus after review edits", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Canonical keyboard journey runs once on desktop");
  await page.goto("/onboarding");

  const study = page.getByRole("button", { name: /study and scholarship funding/i });
  await study.focus();
  await page.keyboard.press("Enter");
  const canada = page.getByLabel("Canada");
  await canada.focus();
  await page.keyboard.press("Space");
  const continueButton = page.getByRole("button", { name: /^continue/i });
  await continueButton.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Background" })).toBeFocused();
  const qualification = page.getByLabel(/highest relevant qualification/i);
  await qualification.focus();
  await page.keyboard.press("Home");
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const field = page.getByLabel(/course or academic field/i);
  await field.focus();
  await page.keyboard.type("Computer science");
  await continueButton.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Experience" })).toBeFocused();
  await continueButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Review" })).toBeFocused();

  const education = page.getByRole("heading", { name: "Education" }).locator("..");
  await education.getByRole("button", { name: "Edit" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Background" })).toBeFocused();
  await page.getByRole("button", { name: /return to review/i }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Review" })).toBeFocused();

  const confirm = page.getByRole("button", { name: /confirm and find opportunities/i });
  await confirm.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/ready for initial matching\. no cv or document is required/i)).toBeVisible();
});

test("onboarding remains operable at 200 percent zoom with mobile-sized targets", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "Canonical zoom and target check uses 390×844");
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto("/onboarding");

  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);

  for (const control of [
    page.getByRole("button", { name: /study and scholarship funding/i }),
    page.getByLabel("Canada").locator(".."),
    page.getByRole("button", { name: /^continue/i }),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.max(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByText("Stage 1 of 4", { exact: true }).first()).toBeVisible();
});
