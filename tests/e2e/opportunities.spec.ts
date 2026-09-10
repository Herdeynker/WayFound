import { expect, test } from "@playwright/test";

test.describe("Phase 8 opportunity experience", () => {
  test("explores safe fixture presentation, filters and detail", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: "Find where you fit." })).toBeVisible();
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog", { name: "Filter opportunities" })).toBeVisible();
    await page.getByLabel("Opportunity type").selectOption({ label: "Professional role" });
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/type=Professional(?:\+|%20)role/);
    await expect(page.getByRole("heading", { name: "Software Engineer" })).toBeVisible();
    const professionalCard = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Software Engineer" }) });
    await professionalCard.getByRole("link", { name: "View details" }).click();
    await expect(page).toHaveURL(/\/opportunities\/demo-professional$/);
    await expect(page.getByRole("heading", { name: "Why this matches" })).toBeVisible();
    await expect(page.getByText(/Employer capability only/)).toBeVisible();
    await expect(page.getByText(/Official application link unavailable/)).toBeVisible();
    await page.goto("/opportunities/demo-scholarship");
    await expect(page.getByRole("link", { name: /Apply on the official site/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });
  test("has a mobile-safe opportunity feed", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "mobile-only assertion");
    await page.goto("/opportunities");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(overflow).toBe(true);
    await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
  });
  test("opens the explicit professional detail action on mobile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "mobile-only assertion");
    await page.goto("/opportunities?type=Professional%20role");
    const professionalCard = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Software Engineer" }) });
    await professionalCard.getByRole("link", { name: "View details" }).click();
    await expect(page).toHaveURL(/\/opportunities\/demo-professional$/);
    await expect(page.getByRole("heading", { name: "Why this matches" })).toBeVisible();
  });
});
