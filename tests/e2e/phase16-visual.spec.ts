import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const evidenceDirectory = process.env.PHASE16_EVIDENCE_DIR ?? "artifacts/phase-16/regression";

async function capture(page: Page, name: string, fullPage = false) {
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidenceDirectory}/${name}.png`, fullPage });
}

test("@visual captures the Phase 16 discovery experience without replacing earlier evidence", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "A single controlled run captures each required viewport.");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Good morning/i })).toBeVisible();
  await capture(page, "dashboard-populated-desktop-1440x900");
  await page.getByRole("button", { name: "Collapse" }).click();
  await capture(page, "checklist-collapsed-desktop-1440x900");

  await page.goto("/dashboard?tour=1");
  await expect(page.getByRole("dialog", { name: /Your home base/i })).toBeVisible();
  await capture(page, "walkthrough-desktop-1440x900");
  await page.getByRole("button", { name: "Next" }).click();
  await capture(page, "walkthrough-explore-desktop-1440x900");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await capture(page, "walkthrough-complete-desktop-1440x900");

  const feeds = [
    ["for_you", "for-you"],
    ["latest", "latest"],
    ["closing_soon", "closing-soon"],
    ["explore_all", "explore-all"],
  ] as const;
  for (const [tab, name] of feeds) {
    await page.goto(`/opportunities?tab=${tab}`);
    await expect(page.getByRole("heading", { name: "Find where you fit." })).toBeVisible();
    await capture(page, `opportunities-${name}-desktop-1440x900`, true);
  }
  await page.goto("/opportunities/demo-professional");
  await expect(page.getByRole("heading", { name: "Why this matches" })).toBeVisible();
  await capture(page, "opportunity-detail-desktop-1440x900", true);

  for (const [url, name] of [
    ["/opportunities?q=no-results", "empty"],
    ["/opportunities?q=permission-denied", "permission-denied"],
    ["/opportunities?destination=%3Cinvalid%3E", "error-retry"],
    ["/settings/privacy?state=loading", "loading"],
    ["/settings/privacy?state=interrupted", "interrupted"],
    ["/settings/privacy?state=stale", "stale"],
  ] as const) {
    await page.goto(url);
    await capture(page, `state-${name}-desktop-1440x900`, true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await capture(page, "dashboard-populated-mobile-390x844");
  await page.goto("/dashboard?tour=1");
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture(page, "walkthrough-mobile-390x844");
  await page.getByRole("button", { name: "Next" }).click();
  await capture(page, "walkthrough-explore-mobile-390x844");
  await page.goto("/opportunities");
  await capture(page, "opportunities-mobile-390x844", true);
  await page.goto("/opportunities/demo-professional");
  await capture(page, "opportunity-detail-mobile-390x844", true);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/dashboard");
  await capture(page, "dashboard-tablet-768x1024");

  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto("/dashboard");
  await capture(page, "dashboard-200-percent-zoom-equivalent-720x450");
});
