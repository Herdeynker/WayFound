import { expect, test } from "@playwright/test";

const evidenceDirectory = process.env.PHASE13_EVIDENCE_DIR ?? "artifacts/phase-13";
const evidencePath = (name: string) =>
  `${evidenceDirectory}/${process.env.PHASE13_PRODUCTION_EVIDENCE === "1" ? "" : "regression-"}${name}`;
const states = [
  ["/prepare/ielts", "ielts-primary", "overview"],
  ["/prepare/ielts?state=empty", "ielts-first-use", "overview"],
  ["/prepare/ielts?state=completed", "ielts-completed", "overview"],
  ["/prepare/ielts?state=loading", "ielts-loading", "overview"],
  ["/prepare/ielts?state=error", "ielts-error", "overview"],
  ["/prepare/ielts?state=interrupted", "ielts-interrupted", "overview"],
  ["/prepare/ielts?state=permission", "ielts-permission-denied", "overview"],
  ["/prepare/ielts?state=disabled", "ielts-provider-disabled", "writing"],
  ["/prepare/ielts", "ielts-reading", "reading"],
  ["/prepare/ielts", "ielts-writing", "writing"],
  ["/prepare/ielts", "ielts-speaking", "speaking"],
] as const;

for (const [url, name, tab] of states) {
  test(`@visual captures Phase 13 ${name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one capture run writes desktop and mobile evidence");
    for (const [width, height, viewport] of [
      [1440, 900, "desktop-1440x900"],
      [390, 844, "mobile-390x844"],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(url);
      if (tab !== "overview" && (await page.getByRole("button", { name: tab, exact: true }).count()))
        await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(page.locator("body")).not.toContainText("Internal Server Error");
      await expect(page.locator("h1, h2").first()).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator("html").screenshot({ path: evidencePath(`${name}-${viewport}.png`) });
    }
  });
}
