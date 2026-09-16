import { expect, test } from "@playwright/test";

test.describe("Phase 16 discovery presentation", () => {
  test("desktop first-use tour uses real navigation anchors", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only assertion");
    await page.goto("/dashboard?tour=1");
    await expect(page.getByRole("dialog", { name: /Your home base/i })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("dialog", { name: /Explore safely/i })).toBeVisible();
    await expect(page.locator("#sidebar-opportunities")).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("mobile first-use tour targets mobile navigation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Mobile-only assertion");
    await page.goto("/dashboard?tour=1");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.locator("#mobile-bottom-nav")).toBeVisible();
    await expect(page.getByText("Explore safely")).toBeVisible();
  });

  test("getting started checklist supports collapsed presentation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your first steps" })).toBeVisible();
    await page.getByRole("button", { name: "Collapse" }).click();
    await expect(page.getByRole("button", { name: "Expand" })).toBeVisible();
    await expect(page.getByText("Choose relocation goals")).toHaveCount(0);
  });
});
