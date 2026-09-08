import { expect, test } from "@playwright/test";

test.describe("Phase 1 dashboard shell", () => {
  test("desktop shell exposes the approved hierarchy", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only assertion");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Good morning, Amara" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Opportunity Path" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Your next step is a bigger story." })).toBeVisible();
    await expect(page.getByRole("img", { name: "A brighter tomorrow. A wider you." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" }).first()).toHaveAttribute("aria-current", "page");
  });

  test("desktop navigation and action card stay separated at reference heights", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only assertion");

    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 1280, height: 800 },
      { width: 1680, height: 945 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");

      const geometry = await page.evaluate(() => {
        const profile = document.querySelector('.sidebar-link[href="#profile"]')?.getBoundingClientRect();
        const signature = document.querySelector(".sidebar-signature")?.getBoundingClientRect();
        const title = document.querySelector(".next-action-card h2")?.getBoundingClientRect();
        const illustration = document
          .querySelector(".next-action-card .profile-illustration")
          ?.getBoundingClientRect();
        const description = document.querySelector(".next-action-card p")?.getBoundingClientRect();
        const button = document.querySelector(".next-action-card .ui-button") as HTMLElement | null;
        return {
          profileBottom: profile?.bottom ?? null,
          signatureTop: signature?.top ?? null,
          titleRight: title?.right ?? null,
          illustrationLeft: illustration?.left ?? null,
          descriptionBottom: description?.bottom ?? null,
          buttonTop: button?.getBoundingClientRect().top ?? null,
          buttonHeight: button?.getBoundingClientRect().height ?? null,
          buttonWhiteSpace: button ? getComputedStyle(button).whiteSpace : null,
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });

      expect(geometry.signatureTop).not.toBeNull();
      expect(geometry.profileBottom).not.toBeNull();
      expect(geometry.signatureTop).toBeGreaterThan(geometry.profileBottom ?? 0);
      expect(geometry.titleRight, JSON.stringify({ viewport, geometry })).toBeLessThanOrEqual(
        geometry.illustrationLeft ?? 0,
      );
      expect(geometry.descriptionBottom).toBeLessThanOrEqual(geometry.buttonTop ?? 0);
      expect(geometry.buttonWhiteSpace).toBe("nowrap");
      expect(geometry.buttonHeight).toBeLessThanOrEqual(56);
      expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    }
  });

  test("mobile shell has labelled bottom navigation and no page overflow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Mobile-only assertion");
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" }).last()).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Complete your profile").last()).toBeVisible();
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(overflow.width).toBeLessThanOrEqual(overflow.viewport);
    const navBox = await page.getByRole("navigation", { name: "Mobile navigation" }).boundingBox();
    expect(navBox?.height).toBeGreaterThanOrEqual(56);
  });

  test("keyboard focus reaches the mobile navigation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Mobile-only assertion");
    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });

  test("mobile breakpoint renders the mobile action, carousel and bottom navigation", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Mobile-only assertion");
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/");

    await expect(page.locator(".mobile-header")).toBeVisible();
    await expect(page.locator(".opportunity-path-mobile")).toBeVisible();
    await expect(page.locator(".next-action-mobile")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await expect(page.getByText("Deadline", { exact: true })).toHaveCount(3);
    await expect(page.getByText("Fixture deadline")).toHaveCount(0);

    const layout = await page.locator(".matches-track").evaluate((track) => ({
      scrollWidth: track.scrollWidth,
      clientWidth: track.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth);
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  });
});
