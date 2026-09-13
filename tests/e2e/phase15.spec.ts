import { expect, test } from "@playwright/test";

test.describe("Phase 15 autonomous opportunity discovery", () => {
  test("keeps the privacy-safe operations summary usable across desktop and mobile", async ({ page }) => {
    await page.goto("/internal/discovery");
    await expect(page.getByRole("heading", { name: "Opportunity discovery" })).toBeVisible();
    await expect(page.getByText("The global opportunity radar is healthy")).toBeVisible();
    await expect(page.getByText("Paid overage: off")).toBeVisible();
    await expect(page.getByText("9 destinations · 7 pathways")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/api key|provider credential|passport id/i);
    await expect(page.locator(".discovery-hero")).toHaveCSS("background-image", /linear-gradient/);
    await expect(page.locator(".discovery-hero h2")).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  for (const [state, text] of [
    ["disabled", "Discovery is safely paused"],
    ["quota-exhausted", "Broad search has stopped for this window"],
    ["empty", "completed with no leads"],
    ["error", "A discovery stage failed safely"],
  ] as const) {
    test(`shows the ${state} state honestly`, async ({ page }) => {
      await page.goto(`/internal/discovery?state=${state}`);
      await expect(page.getByText(text, { exact: false })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(
        /search completed successfully.*failed|paid fallback enabled|using paid fallback/i,
      );
    });
  }

  test("rejects unauthenticated worker triggers", async ({ request }) => {
    const response = await request.post("/api/internal/discovery/web_discovery", {
      headers: { authorization: "Bearer invalid" },
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Unauthorized" });
  });

  test("keeps mobile operational cards readable and touch-safe", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical mobile accessibility check uses 390×844");
    await page.goto("/internal/discovery?state=quota-exhausted");
    const state = page.locator(".discovery-state");
    const box = await state.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(40);
    await expect(page.getByText("New Zealand")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
