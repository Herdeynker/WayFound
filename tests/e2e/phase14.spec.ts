import { expect, test } from "@playwright/test";

test.describe("Phase 14 paid-beta launch readiness", () => {
  test("keeps the trust journey usable and private across desktop and mobile", async ({ page }) => {
    await page.goto("/settings/privacy");
    await expect(
      page.getByRole("heading", { name: "Your information stays under your control" }),
    ).toBeVisible();
    await expect(page.locator("[data-phase14-hydrated='true']")).toBeVisible();
    await expect(page.getByText("No automatic applications")).toBeVisible();
    await page.getByRole("link", { name: /Read policies/ }).click();
    await expect(page.getByRole("heading", { name: "Privacy, terms and product boundaries" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Important disclaimer" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("reports denied, interrupted and disabled states honestly", async ({ page }) => {
    for (const [state, copy] of [
      ["permission", "Permission required"],
      ["interrupted", "The operation was interrupted"],
      ["provider-disabled", "Document scanning is unavailable"],
    ] as const) {
      await page.goto(`/settings/privacy?state=${state}`);
      await expect(page.locator("[data-phase14-hydrated='true']")).toBeVisible();
      await expect(page.getByText(copy)).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/upload complete|access granted/i);
    }
  });

  test("keeps trust and policy controls keyboard and touch accessible", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical accessibility check uses 390×844");
    await page.goto("/settings/privacy?state=loading");
    await expect(page.locator("[data-phase14-hydrated='true']")).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading your privacy controls" })).toHaveAttribute(
      "aria-busy",
      "true",
    );

    await page.goto("/settings/privacy?state=error");
    await expect(page.locator("[data-phase14-hydrated='true']")).toBeVisible();
    const retry = page.getByRole("button", { name: "Retry securely" });
    const retryBox = await retry.boundingBox();
    expect(retryBox?.height).toBeGreaterThanOrEqual(44);
    await retry.focus();
    await expect(retry).toBeFocused();

    const policies = page.getByRole("link", { name: /Read policies/ });
    const policyBox = await policies.boundingBox();
    expect(policyBox?.height).toBeGreaterThanOrEqual(44);
    await policies.focus();
    await expect(policies).toBeFocused();
  });
});
