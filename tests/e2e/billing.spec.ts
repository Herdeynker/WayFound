import { expect, test } from "@playwright/test";

test.describe("Phase 12 billing", () => {
  test("shows the exact launch prices and renewal terms", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the desktop pricing journey is covered once");
    await page.goto("/pricing");
    await expect(
      page.getByRole("heading", { name: "Choose the rhythm that fits your journey." }),
    ).toBeVisible();
    for (const price of ["₦7,000", "₦20,000", "₦80,000"])
      await expect(page.getByText(price, { exact: true })).toBeVisible();
    await expect(page.getByText("Most Popular", { exact: true })).toBeVisible();
    await expect(page.getByText("Best Value", { exact: true })).toBeVisible();
    await expect(page.getByText(/Save ₦160,000/)).toBeVisible();
    await expect(page.getByText(/No free trial/)).toBeVisible();
    await expect(page.getByText(/Renews weekly until cancelled/)).toBeVisible();
    await expect(page.getByText(/Renews monthly until cancelled/)).toBeVisible();
    await expect(page.getByText(/Renews annually until cancelled/)).toBeVisible();

    await page.getByRole("button", { name: "Choose Monthly" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Secure Monthly checkout is ready" }),
    ).toBeVisible();
  });

  test("keeps billing management honest and usable at 390 by 844", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical mobile billing uses 390×844");
    await page.goto("/settings/billing");
    await expect(page.getByRole("heading", { name: "Monthly" })).toBeVisible();
    await expect(page.getByText("₦20,000 / month")).toBeVisible();
    await expect(page.getByRole("button", { name: "Manage payment" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel renewal" }).click();
    await expect(page.getByRole("status")).toContainText("Access continues through the paid-through date");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("renders recovery states without fabricating provider success", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical recovery review uses 390×844");
    await page.goto("/pricing?state=loading");
    await expect(page.getByRole("status", { name: "Loading plans" })).toBeVisible();
    for (const [url, copy] of [
      ["/pricing?state=empty", "No paid plans are available"],
      ["/pricing?state=disabled", "Secure payments are not configured yet"],
      ["/pricing?state=error", "Pricing could not load"],
      ["/pricing?state=interrupted", "Checkout was interrupted"],
      ["/pricing?state=stale", "Your billing view is out of date"],
      ["/pricing?state=permission", "Sign in to manage payment"],
      ["/settings/billing?state=empty", "No active subscription"],
      ["/settings/billing?state=attention", "Payment needs attention"],
      ["/settings/billing?state=expired", "Paid access has ended"],
      ["/settings/billing?state=permission", "Billing is private"],
    ] as const) {
      await page.goto(url);
      await expect(page.getByText(copy, { exact: true })).toBeVisible();
    }
    await page.goto("/settings/billing?state=attention");
    await expect(page.getByRole("button", { name: "Update payment" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review plans" })).toHaveAttribute("href", "/pricing");
    await page.goto("/settings/billing?state=expired");
    await expect(page.getByRole("link", { name: "Choose a plan" })).toHaveAttribute("href", "/pricing");
  });

  test("does not trust browser callback status", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "callback trust boundary is covered once");
    await page.goto("/billing/callback?status=success");
    await expect(page.getByRole("heading", { name: "Checking your payment" })).toBeVisible();
    await expect(page.getByText("Access has not changed", { exact: true })).toBeVisible();
    await expect(page.getByText("Paid access is active", { exact: true })).toHaveCount(0);
  });

  test("keeps pricing controls keyboard reachable and mobile safe", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical accessibility check uses 390×844");
    await page.goto("/pricing");
    const monthly = page.getByRole("button", { name: "Choose Monthly" });
    await monthly.focus();
    await expect(monthly).toBeFocused();
    await expect(monthly).toBeEnabled();
    expect(await monthly.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
