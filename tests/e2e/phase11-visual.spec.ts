import { expect, test } from "@playwright/test";

const evidenceDirectory = process.env.PHASE11_EVIDENCE_DIR ?? "artifacts/phase-11";
const evidencePath = (name: string) =>
  `${evidenceDirectory}/${process.env.PHASE11_PRODUCTION_EVIDENCE === "1" ? "" : "regression-"}${name}`;

const states = [
  ["/settings/notifications", "preferences"],
  ["/settings/notifications?state=empty", "empty"],
  ["/settings/notifications?state=success", "success"],
  ["/settings/notifications?state=loading", "loading"],
  ["/settings/notifications?state=error", "error"],
  ["/settings/notifications?state=interrupted", "interrupted"],
  ["/settings/notifications?state=stale", "stale"],
  ["/settings/notifications?state=disabled", "provider-disabled"],
  ["/settings/notifications?state=permission", "permission-denied"],
] as const;

for (const [url, name] of states) {
  test(`@visual captures Phase 11 ${name}`, async ({ page }, testInfo) => {
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
