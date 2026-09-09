import { expect, test } from "@playwright/test";

test("captures Phase 8 safe discovery evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { name: "Find where you fit." })).toBeVisible();
  await page.screenshot({ path: "artifacts/phase-8/feed-desktop-1440x900.png", fullPage: true });
  await page.goto("/opportunities?q=Scholarship");
  await page.screenshot({ path: "artifacts/phase-8/search-results-desktop-1440x900.png", fullPage: true });
  await page.goto("/opportunities");
  await page.getByRole("link", { name: "Global Technology Scholarship" }).click();
  await page.screenshot({
    path: "artifacts/phase-8/detail-scholarship-desktop-1440x900.png",
    fullPage: true,
  });
  await page.goto("/opportunities");
  await page.getByRole("link", { name: "Software Engineer" }).click();
  await expect(page.getByRole("heading", { name: "Why this matches" })).toBeVisible();
  await page.screenshot({
    path: "artifacts/phase-8/detail-professional-desktop-1440x900.png",
    fullPage: true,
  });
  await page.screenshot({
    path: "artifacts/phase-8/detail-employer-register-warning-desktop-1440x900.png",
    fullPage: true,
  });
  await page.screenshot({
    path: "artifacts/phase-8/detail-missing-information-desktop-1440x900.png",
    fullPage: true,
  });
  await page.screenshot({ path: "artifacts/phase-8/readiness-desktop-1440x900.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/opportunities");
  await page.screenshot({ path: "artifacts/phase-8/feed-mobile-390x844.png", fullPage: true });
  await page.getByRole("link", { name: "Global Technology Scholarship" }).click();
  await page.screenshot({ path: "artifacts/phase-8/detail-scholarship-mobile-390x844.png", fullPage: true });
  await page.goto("/opportunities/demo-professional");
  await page.screenshot({ path: "artifacts/phase-8/readiness-mobile-390x844.png", fullPage: true });
  await page.goto("/opportunities?q=no-results");
  await page.screenshot({ path: "artifacts/phase-8/empty-state-mobile-390x844.png", fullPage: true });
  await page.goto("/opportunities?q=permission-denied");
  await page.screenshot({ path: "artifacts/phase-8/permission-denied-mobile-390x844.png", fullPage: true });
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "Filters" }).click();
  await page.screenshot({ path: "artifacts/phase-8/filters-mobile-390x844.png", fullPage: true });
});
