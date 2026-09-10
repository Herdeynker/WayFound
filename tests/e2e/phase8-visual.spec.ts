import { expect, test } from "@playwright/test";

test("@visual captures Phase 8 safe discovery evidence", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one capture run writes both desktop and mobile evidence");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { name: "Find where you fit." })).toBeVisible();
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-feed-desktop-1440x900.png",
    fullPage: true,
  });
  await page.goto("/opportunities?q=Scholarship");
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-search-results-desktop-1440x900.png",
    fullPage: true,
  });
  await page.goto("/opportunities");
  await page
    .getByRole("article")
    .filter({ hasText: "Global Technology Scholarship" })
    .getByRole("link", { name: "View details" })
    .click();
  await expect(page).toHaveURL(/\/opportunities\/demo-scholarship$/);
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-detail-scholarship-desktop-1440x900.png",
    fullPage: true,
  });
  await page.goto("/opportunities");
  await page
    .getByRole("article")
    .filter({ hasText: "Software Engineer" })
    .getByRole("link", { name: "View details" })
    .click();
  await expect(page).toHaveURL(/\/opportunities\/demo-professional$/);
  await expect(page.getByRole("heading", { name: "Why this matches" })).toBeVisible();
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-detail-professional-desktop-1440x900.png",
    fullPage: true,
  });
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-employer-warning-desktop-1440x900.png",
    fullPage: true,
  });
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-missing-information-desktop-1440x900.png",
    fullPage: true,
  });
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-readiness-desktop-1440x900.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/opportunities");
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-feed-mobile-390x844.png",
    fullPage: true,
  });
  await page
    .getByRole("article")
    .filter({ hasText: "Global Technology Scholarship" })
    .getByRole("link", { name: "View details" })
    .click();
  await expect(page).toHaveURL(/\/opportunities\/demo-scholarship$/);
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-detail-scholarship-mobile-390x844.png",
    fullPage: true,
  });
  await page.goto("/opportunities/demo-professional");
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-readiness-mobile-390x844.png",
    fullPage: true,
  });
  await page.goto("/opportunities?q=no-results");
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-empty-mobile-390x844.png",
    fullPage: true,
  });
  await page.goto("/opportunities?q=permission-denied");
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-permission-denied-mobile-390x844.png",
    fullPage: true,
  });
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "Filters" }).click();
  await page.screenshot({
    path: "artifacts/phase-9/regression-phase8-filters-mobile-390x844.png",
    fullPage: true,
  });
});
