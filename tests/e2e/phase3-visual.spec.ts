import { test } from "@playwright/test";

test("goal selection visual", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/onboarding");
  await page.screenshot({
    path: `artifacts/phase-3/goal-selection-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("academic and review visual states", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Study and scholarship funding/i }).click();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await page.screenshot({ path: `artifacts/phase-3/academic-${testInfo.project.name}.png`, fullPage: true });
});
