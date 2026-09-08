import { expect, test } from "@playwright/test";

test.describe("Phase 2 visual evidence", () => {
  test("captures the mobile-first authentication surfaces", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Visual evidence is captured once from the desktop project.",
    );
    const screens = [
      [1440, 900, "/login", "login-desktop-1440x900"],
      [390, 844, "/login", "login-mobile-390x844"],
      [390, 844, "/register", "register-mobile-390x844"],
      [390, 844, "/forgot-password", "forgot-password-mobile-390x844"],
      [390, 844, "/consent", "consent-mobile-390x844"],
      [1440, 900, "/settings/account", "account-settings-desktop-1440x900"],
      [390, 844, "/settings/account", "account-settings-mobile-390x844"],
    ] as const;
    for (const [width, height, path, name] of screens) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await expect(page.locator("body")).toBeVisible();
      await page.screenshot({ path: `artifacts/phase-2/${name}.png`, fullPage: false });
    }
    await page.getByRole("button", { name: "Request account deletion" }).click();
    await expect(page.getByRole("dialog", { name: "Request account deletion?" })).toBeVisible();
    await page.screenshot({
      path: "artifacts/phase-2/deletion-confirmation-mobile-390x844.png",
      fullPage: false,
    });
  });
});
