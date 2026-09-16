import { expect, test, type Page } from "@playwright/test";

const evidenceDirectory = process.env.ONBOARDING_EVIDENCE_DIR ?? "artifacts/onboarding-optimization";

async function capture(page: Page, name: string, project: string) {
  await expect(page.locator("body")).not.toContainText(/step\s+\d+\s+of\s+11/i);
  await page.screenshot({ path: `${evidenceDirectory}/${name}-${project}.png`, fullPage: true });
}

async function startPath(page: Page, goal: RegExp, open = false) {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: goal }).click();
  if (open) await page.getByLabel(/open to suitable destinations/i).check();
  else await page.getByLabel("Canada").check();
  await page.getByRole("button", { name: /^continue/i }).click();
  await expect(page.getByRole("heading", { name: "Background" })).toBeVisible();
}

async function reachProfessionalExperience(page: Page) {
  await startPath(page, /professional jobs with sponsorship/i, true);
  await page.getByLabel(/current or recent occupation/i).fill("Software engineer");
  await page.getByLabel(/employment status/i).selectOption("employed");
  await page.getByRole("button", { name: /^continue/i }).click();
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
}

async function completeProfessionalExperience(page: Page) {
  await page.getByLabel(/year you started/i).fill("2021");
  await page.getByLabel(/add at least one skill/i).fill("TypeScript");
  await page.getByRole("button", { name: /add skill/i }).click();
}

test("@visual canonical four-stage onboarding evidence", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  test.setTimeout(180_000);
  await page.setViewportSize(
    testInfo.project.name === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
  );
  const project = testInfo.project.name;

  await page.goto("/onboarding");
  await capture(page, "stage-1-goals", project);
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "validation-errors", project);

  await startPath(page, /study and scholarship funding/i);
  await capture(page, "stage-2-background", project);
  await page.getByLabel(/highest relevant qualification/i).selectOption("Bachelor's");
  await page.getByLabel(/course or academic field/i).fill("Computer science");
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "stage-3-study", project);
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "stage-4-review", project);
  await capture(page, "review-deferred", project);
  await page.getByRole("button", { name: /confirm and find opportunities/i }).click();
  await capture(page, "post-confirmation-transition", project);

  await reachProfessionalExperience(page);
  await capture(page, "stage-3-professional", project);

  await startPath(page, /skilled or trade work with sponsorship/i, true);
  await page.getByLabel(/trade or occupation/i).fill("Welder");
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "stage-3-skilled-trade", project);

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /professional jobs with sponsorship/i }).click();
  await page.getByRole("button", { name: /skilled or trade work with sponsorship/i }).click();
  await page.getByLabel(/open to suitable destinations/i).check();
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByLabel(/current or recent occupation/i).fill("Operations manager");
  await page.getByLabel(/employment status/i).selectOption("employed");
  await page.getByLabel(/trade or occupation/i).fill("Electrician");
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "stage-3-multi-goal", project);

  await page.goto("/onboarding?scenario=saving");
  await capture(page, "autosave-saving", project);
  await page.goto("/onboarding?scenario=error");
  await capture(page, "autosave-error-retry", project);
  await page.goto("/onboarding?scenario=resumed");
  await capture(page, "resumed-onboarding", project);
  await page.goto("/onboarding?scenario=permission");
  await capture(page, "permission-denied", project);

  await page.goto("/dashboard");
  await capture(page, "dashboard-after-onboarding", project);
});

test("@visual professional review keeps deferred information honest", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  await page.setViewportSize(
    testInfo.project.name === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
  );
  await reachProfessionalExperience(page);
  await completeProfessionalExperience(page);
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "stage-4-professional-review", testInfo.project.name);
});
