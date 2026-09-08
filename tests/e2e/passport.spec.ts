import { test, expect } from "@playwright/test";

test("multi-goal Passport reveals the union of relevant sections", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: /Build a profile that travels with you/i })).toBeVisible();
  await page.getByRole("button", { name: /Study and scholarship funding/i }).click();
  await page.getByRole("button", { name: /Professional jobs with sponsorship/i }).click();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await expect(page.getByRole("heading", { name: "Destinations" })).toBeVisible();
  await page.getByLabel("Canada").check();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await expect(page.getByRole("heading", { name: "Academic history" })).toBeVisible();
  await page.getByRole("button", { name: /Save and continue/i }).click();
  await expect(page.getByRole("heading", { name: "Professional history" })).toBeVisible();
});

test("Passport keeps an honest disabled parsing state on the document step", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Study and scholarship funding/i }).click();
  for (let index = 0; index < 6; index += 1)
    await page.getByRole("button", { name: /Save and continue/i }).click();
  await expect(page.getByRole("heading", { name: "Document readiness" })).toBeVisible();
  await expect(page.getByText(/Stored privately in your account/i)).toBeVisible();
});
