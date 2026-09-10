import { expect, test } from "@playwright/test";

const evidenceDirectory = process.env.PHASE10_EVIDENCE_DIR ?? "artifacts/phase-10";
const evidencePath = (name: string) =>
  `${evidenceDirectory}/${process.env.PHASE10_PRODUCTION_EVIDENCE === "1" ? "" : "regression-"}${name}`;

const states = [
  ["/prepare/assistant", "writing"],
  ["/prepare/assistant?state=success", "analysis-success"],
  ["/prepare/assistant?state=empty", "empty"],
  ["/prepare/assistant?state=loading", "loading"],
  ["/prepare/assistant?state=error", "error"],
  ["/prepare/assistant?state=interrupted", "interrupted"],
  ["/prepare/assistant?state=stale", "stale"],
  ["/prepare/assistant?state=permission", "permission-denied"],
  ["/prepare/assistant?state=disabled", "provider-disabled"],
  ["/prepare/assistant?state=completed", "approved-export"],
] as const;

for (const [url, name] of states) {
  test(`@visual captures Phase 10 ${name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one capture run writes desktop and mobile evidence");
    for (const [width, height, viewport] of [
      [1440, 900, "desktop-1440x900"],
      [390, 844, "mobile-390x844"],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(url);
      await expect(page.locator("body")).not.toContainText("Internal Server Error");
      await expect(page.locator("h1, h2").first()).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator("html").screenshot({ path: evidencePath(`${name}-${viewport}.png`) });
    }
  });
}
