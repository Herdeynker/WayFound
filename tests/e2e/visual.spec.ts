import { expect, test } from "@playwright/test";

test.describe("Phase 1 visual evidence", () => {
  test.setTimeout(120_000);

  test("captures approved desktop and mobile viewport evidence", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Visual evidence is captured once from the desktop project.",
    );
    const viewports = [
      [1680, 945, "desktop-1680x945"],
      [1280, 800, "desktop-1280x800"],
      [390, 844, "mobile-390x844"],
      [360, 800, "mobile-360x800"],
      [430, 932, "mobile-430x932"],
    ] as const;

    for (const [width, height, name] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(page.locator("body")).toBeVisible();
      await page.screenshot({ path: `artifacts/phase-1/${name}.png`, fullPage: false });
    }
  });
});
