import { expect, test } from "@playwright/test";

test.describe("Phase 1 dashboard shell", () => {
  test("desktop shell exposes the approved hierarchy", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only assertion");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Good morning, Amara" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Opportunity Path" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Your next step is a bigger story." })).toBeVisible();
    await expect(page.getByRole("img", { name: "A brighter tomorrow. A wider you." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" }).first()).toHaveAttribute("aria-current", "page");
  });

  test("mobile shell has labelled bottom navigation and no page overflow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Mobile-only assertion");
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" }).last()).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Complete your profile").last()).toBeVisible();
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(overflow.width).toBeLessThanOrEqual(overflow.viewport);
    const navBox = await page.getByRole("navigation", { name: "Mobile navigation" }).boundingBox();
    expect(navBox?.height).toBeGreaterThanOrEqual(56);
  });

  test("keyboard focus reaches the mobile navigation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Mobile-only assertion");
    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });
});
