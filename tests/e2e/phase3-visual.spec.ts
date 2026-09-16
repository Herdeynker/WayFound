import { test } from "@playwright/test";
import type { Page } from "@playwright/test";

const evidenceDirectory = process.env.PHASE3_EVIDENCE_DIR ?? "artifacts/phase-9";

async function captureEvidence(page: Page, path: string) {
  await page.screenshot({ path, fullPage: true });
}

test("@visual goal selection", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/onboarding");
  await captureEvidence(
    page,
    `${evidenceDirectory}/regression-phase3-goal-selection-${testInfo.project.name}.png`,
  );
});

test("@visual academic and review states", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Study and scholarship funding/i }).click();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await captureEvidence(page, `${evidenceDirectory}/regression-phase3-academic-${testInfo.project.name}.png`);
});
