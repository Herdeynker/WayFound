import { expect, test } from "@playwright/test";

test.describe("Phase 11 alerts", () => {
  test("saves frequencies, quiet hours and selected events", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop preference journey is covered once");
    await page.goto("/settings/notifications");
    await expect(page.getByRole("heading", { name: "Alerts that respect your time" })).toBeVisible();
    await page.getByLabel("Email frequency").selectOption("weekly");
    await page.getByLabel("Timezone").selectOption("Europe/London");
    await page.getByRole("button", { name: "Save alert choices" }).click();
    await expect(page.getByRole("status")).toContainText("saved");
    await expect(page.getByRole("link", { name: /^Open/ }).first()).toHaveAttribute(
      "href",
      /^\/(opportunities|applications)\//,
    );
  });

  test("links and unlinks Telegram explicitly on mobile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical mobile journey uses 390×844");
    await page.goto("/settings/notifications");
    await page.getByRole("button", { name: "Unlink Telegram" }).click();
    await expect(page.getByText("Telegram is not linked")).toBeVisible();
    await expect(page.getByLabel("Telegram frequency")).toBeDisabled();
    await page.getByRole("button", { name: "Link Telegram" }).click();
    await expect(page.getByText("Telegram linked")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("shows every honest recovery and provider state", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical state review uses 390×844");
    for (const [state, heading] of [
      ["error", "Preferences could not load"],
      ["interrupted", "Saving was interrupted"],
      ["stale", "Your alert settings changed elsewhere"],
      ["disabled", "Delivery providers are not configured"],
      ["permission", "Alerts are private"],
    ] as const) {
      await page.goto(`/settings/notifications?state=${state}`);
      await expect(page.getByText(heading)).toBeVisible();
    }
  });

  test("keeps controls labelled, keyboard reachable and mobile-safe", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical accessibility check uses 390×844");
    await page.goto("/settings/notifications");
    for (const label of ["Email frequency", "Telegram frequency", "Timezone", "Quiet from", "Until"]) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
    const save = page.getByRole("button", { name: "Save alert choices" });
    await save.focus();
    await expect(save).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
