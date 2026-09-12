import { expect, test } from "@playwright/test";

const evidenceDirectory = process.env.PHASE14_EVIDENCE_DIR ?? "artifacts/phase-14";
const evidencePath = (name: string) =>
  `${evidenceDirectory}/${process.env.PHASE14_PRODUCTION_EVIDENCE === "1" ? "" : "regression-"}${name}`;
const states = [
  ["/settings/privacy", "trust-primary"],
  ["/settings/privacy?state=first-use", "trust-first-use"],
  ["/settings/privacy?state=success", "trust-success"],
  ["/settings/privacy?state=loading", "trust-loading"],
  ["/settings/privacy?state=error", "trust-error"],
  ["/settings/privacy?state=interrupted", "trust-interrupted"],
  ["/settings/privacy?state=stale", "trust-stale"],
  ["/settings/privacy?state=permission", "trust-permission-denied"],
  ["/settings/privacy?state=provider-disabled", "trust-provider-disabled"],
  ["/legal", "legal-policies"],
] as const;

for (const [url, name] of states) {
  test(`@visual captures Phase 14 ${name}`, async ({ page }, testInfo) => {
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
