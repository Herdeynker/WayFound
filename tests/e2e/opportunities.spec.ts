import { expect, test } from "@playwright/test";

test.describe("Phase 8 opportunity experience", () => {
  test("explores safe fixture presentation, filters and detail", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: "Find where you fit." })).toBeVisible();
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog", { name: "Filter opportunities" })).toBeVisible();
    await page.getByLabel("Opportunity type").selectOption({ label: "Professional role" });
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("heading", { name: "Software Engineer" })).toBeVisible();
    await page.getByRole("link", { name: "Software Engineer" }).click();
    await expect(page.getByRole("heading", { name: "Why this matches" })).toBeVisible();
    await expect(page.getByText(/Employer capability only/)).toBeVisible();
  });
  test("has a mobile-safe opportunity feed", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "mobile-only assertion");
    await page.goto("/opportunities");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(overflow).toBe(true);
    await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
  });
});
