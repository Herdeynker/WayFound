import { expect, test } from "@playwright/test";

test.describe("Phase 2 access boundaries", () => {
  test("renders mobile-friendly sign-in and honest provider fallback", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to WAYFOUND" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Google sign-in unavailable" })).toBeDisabled();
    await expect(page.getByLabel("Email address")).toHaveAttribute("autocomplete", "email");
  });

  test("does not let an unauthenticated request open the dashboard", async ({ playwright }) => {
    const context = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3000",
      maxRedirects: 0,
      extraHTTPHeaders: { "x-wayfound-test-auth": "unauthenticated-check" },
    });
    const response = await context.get("/dashboard");
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers().location).toContain("/login");
    await context.dispose();
  });

  test("keeps OAuth disabled response honest", async ({ playwright }) => {
    const context = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3000",
      maxRedirects: 0,
    });
    const response = await context.get("/api/auth/oauth?next=https%3A%2F%2Fevil.example");
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({
      error: "Google sign-in is not enabled for this environment yet.",
    });
    await context.dispose();
  });
});
