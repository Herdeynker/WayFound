import { expect, test } from "@playwright/test";

test.describe("Phase 9 document and application experience", () => {
  test("keeps preparation state honest and checklist order deterministic", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop journey is covered once");

    await page.goto("/applications");
    await expect(page.getByRole("heading", { name: "Move from match to momentum." })).toBeVisible();
    await page.getByRole("link", { name: "Open workspace" }).click();
    await expect(page).toHaveURL(/\/applications\/11111111-1111-4111-8111-111111111111$/);
    await expect(page.getByRole("heading", { name: "Global Technology Scholarship" })).toBeVisible();
    await expect(page.locator(".checklist span")).toHaveText([
      /Official transcript required/,
      /Statement of purpose required/,
      /Academic reference conditional/,
    ]);

    await page.goto("/applications?state=completed");
    await expect(page.getByText("3/3 complete")).toBeVisible();
    await expect(page.locator(".ui-badge", { hasText: "accepted" })).toBeVisible();
    await page.goto("/applications?state=permission");
    await expect(page.getByRole("heading", { name: "Private applications unavailable" })).toBeVisible();
  });

  test("supports cancellable upload recovery on the primary mobile viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical mobile journey uses 390×844");

    await page.goto("/prepare/documents");
    await expect(page.getByRole("heading", { name: "Your document library" })).toBeVisible();
    await page.waitForTimeout(1_000);
    await page.reload({ waitUntil: "networkidle" });
    const fileInput = page.locator('input[type="file"][name="file"]');
    await expect(fileInput).toHaveAttribute("capture", "environment");
    await page.getByLabel("Document type").fill("Passport");
    await fileInput.setInputFiles({
      buffer: Buffer.from("%PDF-1.4 phase9 fixture"),
      mimeType: "application/pdf",
      name: "passport.pdf",
    });
    await page.route("**/api/documents", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.fulfill({ contentType: "application/json", json: { ok: true }, status: 200 });
    });
    await page.getByRole("button", { name: "Upload private document" }).click();
    await expect(page.getByRole("button", { name: "Cancel upload" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel upload" }).click();
    await expect(page.locator(".field-error[role='alert']")).toContainText("Upload cancelled");
    await expect(page.getByRole("heading", { name: "Upload recovery available" })).toBeVisible();

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.route("**/api/documents", async (route) => {
      await route.fulfill({ contentType: "application/json", json: { ok: true }, status: 200 });
    });
    await fileInput.setInputFiles({
      buffer: Buffer.from("%PDF-1.4 phase9 fixture"),
      mimeType: "application/pdf",
      name: "passport.pdf",
    });
    await page.getByRole("button", { name: "Upload private document" }).click();
    await expect(page.getByText(/Document saved privately/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upload recovery available" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("exposes accessible loading, error and permission states", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical accessibility pass uses 390×844");

    await page.goto("/prepare/documents?state=loading");
    await expect(page.locator("main [aria-busy='true'], section[aria-busy='true']")).toBeVisible();
    await page.waitForTimeout(1_000);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/prepare/documents?state=error");
    await expect(page.getByRole("alert")).toContainText("existing files are unchanged");
    await page.goto("/prepare/documents?state=permission");
    const signIn = page.getByRole("link", { name: "Sign in securely" });
    await expect(signIn).toBeVisible();
    await page.keyboard.press("Tab");
    await signIn.focus();
    await expect(signIn).toBeFocused();
    expect(await signIn.evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
