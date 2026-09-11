import { expect, test } from "@playwright/test";

test.describe("Phase 13 IELTS foundation", () => {
  test("completes the desktop diagnostic with deterministic unofficial scoring", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop diagnostic journey is covered once");
    await page.goto("/prepare/ielts");
    await expect(page.getByRole("heading", { name: /Practice with a clearer route/ })).toBeVisible();
    await page.getByRole("button", { name: "reading", exact: true }).click();
    await page.getByRole("button", { name: "Start timed diagnostic" }).click();
    const radios = await page.getByRole("radio").all();
    for (const index of [0, 3, 6, 9]) await radios[index].check();
    await page.getByRole("button", { name: "Score my answers" }).click();
    await expect(page.getByText(/not an official IELTS score/)).toBeVisible();
  });

  test("saves setup and completes writing feedback on 390×844", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "canonical mobile journey uses 390×844");
    await page.goto("/prepare/ielts?state=empty");
    await page.getByLabel("Test type").selectOption("general");
    await page.getByRole("button", { name: "Save IELTS goal" }).click();
    await expect(page.getByText(/IELTS route is saved/)).toBeVisible();
    await page.getByRole("button", { name: "writing", exact: true }).click();
    await page
      .getByLabel("Writing response")
      .fill(
        "The main trend is clear and the figures change over time. This response compares the two periods and explains the most relevant difference. ".repeat(
          4,
        ),
      );
    await page.getByRole("button", { name: "Request estimated feedback" }).click();
    await expect(page.getByText("Unofficial estimate")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("handles denied microphone permission and interrupted recovery", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "mobile recording recovery is covered once");
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: () => Promise.reject(new Error("denied")) },
      }),
    );
    await page.goto("/prepare/ielts?state=interrupted");
    await expect(page.getByRole("heading", { name: "Practice was interrupted" })).toBeVisible();
    await page.getByRole("button", { name: "speaking", exact: true }).click();
    await page.getByRole("button", { name: "Start microphone recording" }).click();
    await expect(page.locator("p[role='alert']")).toContainText("permission was denied");
    await expect(page.getByLabel("Or choose audio")).toBeVisible();
  });

  test("keeps state, labels, controls and focus accessible", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-360", "smallest mobile accessibility pass is covered once");
    await page.goto("/prepare/ielts?state=disabled");
    await expect(page.getByRole("navigation", { name: "IELTS practice tools" })).toBeVisible();
    await page.getByRole("button", { name: "writing", exact: true }).click();
    await expect(page.getByRole("heading", { name: /not configured/ })).toBeVisible();
    await page.getByRole("button", { name: "reading", exact: true }).focus();
    await expect(page.getByRole("button", { name: "reading", exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
