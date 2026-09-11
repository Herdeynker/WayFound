import { expect, test } from "@playwright/test";

const evidenceDirectory = process.env.PHASE12_EVIDENCE_DIR ?? "artifacts/phase-12";
const evidencePath = (name: string) =>
  `${evidenceDirectory}/${process.env.PHASE12_PRODUCTION_EVIDENCE === "1" ? "" : "regression-"}${name}`;

const states = [
  ["/pricing", "pricing"],
  ["/pricing?state=loading", "pricing-loading"],
  ["/pricing?state=empty", "pricing-empty"],
  ["/pricing?state=success", "pricing-success"],
  ["/pricing?state=disabled", "pricing-provider-disabled"],
  ["/pricing?state=error", "pricing-error"],
  ["/pricing?state=interrupted", "checkout-interrupted"],
  ["/pricing?state=stale", "pricing-stale"],
  ["/pricing?state=permission", "pricing-permission-denied"],
  ["/billing/callback", "callback-pending"],
  ["/billing/callback?state=success", "callback-verified"],
  ["/settings/billing", "billing-active"],
  ["/settings/billing?state=loading", "billing-loading"],
  ["/settings/billing?state=empty", "billing-empty"],
  ["/settings/billing?state=error", "billing-error"],
  ["/settings/billing?state=interrupted", "billing-interrupted"],
  ["/settings/billing?state=stale", "billing-stale"],
  ["/settings/billing?state=disabled", "billing-provider-disabled"],
  ["/settings/billing?state=attention", "billing-attention"],
  ["/settings/billing?state=expired", "billing-expired"],
  ["/settings/billing?state=non_renewing", "billing-non-renewing"],
  ["/settings/billing?state=permission", "billing-permission-denied"],
] as const;

for (const [url, name] of states) {
  test(`@visual captures Phase 12 ${name}`, async ({ page }, testInfo) => {
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
