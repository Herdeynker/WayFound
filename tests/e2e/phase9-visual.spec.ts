import { expect, test } from "@playwright/test";

const evidenceDirectory = process.env.PHASE9_EVIDENCE_DIR ?? "artifacts/phase-9";
const evidencePath = (name: string) =>
  `${evidenceDirectory}/${process.env.PHASE9_PRODUCTION_EVIDENCE === "1" ? "" : "regression-"}${name}`;

const states = [
  ["/prepare/documents", "documents"],
  ["/applications", "applications"],
  ["/applications/fixture-workspace", "workspace"],
  ["/prepare/documents?state=empty", "documents-empty"],
  ["/prepare/documents?state=loading", "documents-loading"],
  ["/prepare/documents?state=success", "documents-success"],
  ["/prepare/documents?state=error", "documents-error"],
  ["/prepare/documents?state=interrupted", "documents-interrupted"],
  ["/prepare/documents?state=permission", "documents-permission-denied"],
  ["/applications?state=empty", "applications-empty"],
  ["/applications?state=loading", "applications-loading"],
  ["/applications?state=error", "applications-error"],
  ["/applications?state=permission", "applications-permission-denied"],
  ["/applications?state=completed", "applications-completed"],
  ["/applications/fixture-workspace?state=completed", "workspace-completed"],
] as const;

for (const [url, stateName] of states) {
  test(`@visual captures Phase 9 ${stateName}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one capture run writes desktop and mobile evidence");

    for (const [width, height, viewportName] of [
      [1440, 900, "desktop-1440x900"],
      [390, 844, "mobile-390x844"],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(url);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Internal Server Error");
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.locator("h1")).toBeInViewport();
      await page.locator("html").screenshot({ path: evidencePath(`${stateName}-${viewportName}.png`) });
    }
  });
}
