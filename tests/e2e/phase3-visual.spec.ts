import { test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function captureEvidence(page: Page, path: string) {
  try {
    await page.screenshot({ path, fullPage: true });
  } catch {
    await page.screenshot({ path: path.replace(/\.png$/, "-retry.png"), fullPage: true });
  }
}

test("@visual goal selection", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/onboarding");
  await captureEvidence(
    page,
    `artifacts/phase-9/regression-phase3-goal-selection-${testInfo.project.name}.png`,
  );
});

test("@visual academic and review states", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Study and scholarship funding/i }).click();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await captureEvidence(page, `artifacts/phase-9/regression-phase3-academic-${testInfo.project.name}.png`);
});
