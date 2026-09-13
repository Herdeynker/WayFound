import { expect, test } from "@playwright/test";

const evidenceDirectory = process.env.PHASE15_EVIDENCE_DIR ?? "artifacts/phase-15";
const evidencePath = (name: string) =>
  `${evidenceDirectory}/${process.env.PHASE15_PRODUCTION_EVIDENCE === "1" ? "" : "regression-"}${name}`;
const states = [
  ["/internal/discovery", "discovery-ready"],
  ["/internal/discovery?state=disabled", "discovery-provider-disabled"],
  ["/internal/discovery?state=quota-exhausted", "discovery-quota-exhausted"],
  ["/internal/discovery?state=empty", "discovery-empty"],
  ["/internal/discovery?state=error", "discovery-error"],
] as const;

for (const [url, name] of states) {
  test(`@visual captures Phase 15 ${name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one capture run writes desktop and mobile evidence");
    for (const [width, height, viewport] of [
      [1440, 900, "desktop-1440x900"],
      [390, 844, "mobile-390x844"],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(url);
      await expect(page.getByRole("heading", { name: "Opportunity discovery" })).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Internal Server Error");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator("html").screenshot({ path: evidencePath(`${name}-${viewport}.png`) });
    }
  });
}
