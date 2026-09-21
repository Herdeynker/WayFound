import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type { Database } from "@/server/supabase/database.types";

loadEnvConfig(process.cwd());

// Keep the approved Phase 3 evidence immutable; this corrective suite writes only new evidence.
const evidenceDirectory =
  process.env.ONBOARDING_PATHWAY_FIX_EVIDENCE_DIR ?? "artifacts/onboarding-pathway-fix";

async function capture(page: Page, name: string, project: string) {
  await expect(page.locator("body")).not.toContainText(/step\s+\d+\s+of\s+11/i);
  await page.screenshot({ path: `${evidenceDirectory}/${name}-${project}.png`, fullPage: true });
}

async function startPath(page: Page, goal: RegExp, open = false) {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: goal }).click();
  if (open) await page.getByLabel(/open to suitable destinations/i).check();
  else await page.getByLabel("Canada").check();
  await page.getByRole("button", { name: /^continue/i }).click();
  await expect(page.getByRole("heading", { name: "Background" })).toBeVisible();
}

async function reachProfessionalExperience(page: Page) {
  await startPath(page, /professional jobs with sponsorship/i, true);
  await page.getByRole("button", { name: /^continue/i }).click();
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
}

async function completeProfessionalExperience(page: Page) {
  await page.getByLabel(/current or recent occupation/i).fill("Software engineer");
  await page.getByLabel(/employment status/i).selectOption("employed");
  await page.getByLabel(/year you started/i).fill("2021");
  await page.getByLabel(/add at least one skill/i).fill("TypeScript");
  await page.getByRole("button", { name: /add skill/i }).click();
}

test("@visual canonical four-stage onboarding evidence", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  test.setTimeout(180_000);
  await page.setViewportSize(
    testInfo.project.name === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
  );
  const project = testInfo.project.name;

  await page.goto("/onboarding");
  await capture(page, "stage-1-goals", project);
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "validation-errors", project);

  await startPath(page, /study and scholarship funding/i);
  await capture(page, "stage-2-background", project);
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "stage-3-study", project);
  await page.getByLabel(/highest relevant qualification/i).selectOption("Bachelor's");
  await page.getByLabel(/course or academic field/i).fill("Computer science");
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "stage-4-review", project);
  await capture(page, "review-deferred", project);
  await page.getByRole("button", { name: /confirm and find opportunities/i }).click();
  await capture(page, "post-confirmation-transition", project);

  await reachProfessionalExperience(page);
  await capture(page, "stage-3-professional", project);

  await startPath(page, /skilled or trade work with sponsorship/i, true);
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "stage-3-skilled-trade", project);

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /professional jobs with sponsorship/i }).click();
  await page.getByRole("button", { name: /skilled or trade work with sponsorship/i }).click();
  await page.getByLabel(/open to suitable destinations/i).check();
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "multi-goal-focus-selector", project);

  await page.goto("/onboarding");
  for (const name of [
    /study and scholarship funding/i,
    /professional jobs with sponsorship/i,
    /skilled or trade work with sponsorship/i,
  ])
    await page.getByRole("button", { name }).click();
  await page.getByLabel(/open to suitable destinations/i).check();
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "all-routes-focus-selector", project);
  await page.getByRole("button", { name: /study, scholarships and research/i }).click();
  await capture(page, "all-routes-study-focus", project);
  await page.getByRole("button", { name: /sponsored professional work/i }).click();
  await capture(page, "all-routes-professional-focus", project);
  await page.getByRole("button", { name: /skilled\/trade work/i }).click();
  await capture(page, "all-routes-trade-focus", project);
  await page.getByRole("button", { name: /i’m still exploring/i }).click();
  await capture(page, "still-exploring-stage-3", project);
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "review-with-deferred-pathways", project);

  await page.goto("/onboarding?scenario=saving");
  await capture(page, "autosave-saving", project);
  await page.goto("/onboarding?scenario=error");
  await capture(page, "autosave-error-retry", project);
  await page.goto("/onboarding?scenario=resumed");
  await capture(page, "resumed-onboarding", project);
  await page.goto("/onboarding?scenario=permission");
  await capture(page, "permission-denied", project);
});

test("@visual professional review keeps deferred information honest", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  await page.setViewportSize(
    testInfo.project.name === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
  );
  await reachProfessionalExperience(page);
  await completeProfessionalExperience(page);
  await page.getByRole("button", { name: /^continue/i }).click();
  await capture(page, "stage-4-professional-review", testInfo.project.name);
});

const hostedUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const hostedSecret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const hostedEvidenceAvailable = Boolean(hostedUrl && hostedSecret);

async function captureHostedDashboard(browser: Browser, project: string, focus: "academic" | "exploring") {
  if (!hostedUrl || !hostedSecret) throw new Error("Hosted visual credentials are unavailable");
  if (new URL(hostedUrl).hostname !== "lzhnneiavofdwvbbnbvm.supabase.co")
    throw new Error("Hosted visual evidence requires the dedicated WAYFOUND development project");

  const admin = createClient<Database>(hostedUrl, hostedSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const testId = crypto.randomUUID();
  const email = `onboarding-visual-${testId}@example.test`;
  const password = `OnboardingVisual-${testId}-Safe!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "Wayfound" },
  });
  if (created.error || !created.data.user)
    throw new Error(
      `Could not create hosted visual test user (${created.error?.status ?? "unknown"}: ${created.error?.code ?? "unknown"})`,
    );
  const userId = created.data.user.id;
  const mobile = project === "mobile-390";
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3000"}`,
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    extraHTTPHeaders: { "x-wayfound-test-auth": "" },
  });
  try {
    const consents = ["profile_matching", "ai_processing", "document_storage"].map((consentType) => ({
      user_id: userId,
      policy_version: "2026-09-08.v1",
      consent_type: consentType,
      granted: true,
      required: true,
      source: "web",
    }));
    if ((await admin.from("user_consents").insert(consents)).error)
      throw new Error("Could not record hosted visual test consent");

    const page = await context.newPage();
    const login = await context.request.post("/api/auth/login", { data: { email, password } });
    if (!login.ok()) throw new Error("Could not authenticate hosted visual test user");
    await page.goto("/onboarding");
    await expect(page.getByText("Preview mode")).toHaveCount(0);
    await page.getByRole("button", { name: /study and scholarship funding/i }).click();
    if (focus === "exploring") {
      await page.getByRole("button", { name: /professional jobs with sponsorship/i }).click();
      await page.getByRole("button", { name: /skilled or trade work with sponsorship/i }).click();
    }
    await page.getByLabel(/open to suitable destinations/i).check();
    await page.getByRole("button", { name: /^continue/i }).click();
    await expect(page.getByRole("heading", { name: "Background" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^continue/i }).click();
    await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible({ timeout: 15_000 });
    if (focus === "exploring") {
      await page.getByRole("button", { name: /i’m still exploring/i }).click();
    } else {
      await page.getByLabel(/highest relevant qualification/i).selectOption("Bachelor's");
      await page.getByLabel(/course or academic field/i).fill("Computer science");
    }
    await page.getByRole("button", { name: /^continue/i }).click();
    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /confirm and find opportunities/i }).click();
    await expect(page).toHaveURL(/\/pricing\?onboarding=complete/, { timeout: 30_000 });
    const completedProgress = await admin
      .from("onboarding_progress")
      .select("completion,completed_at")
      .eq("user_id", userId)
      .single();
    expect(completedProgress.error).toBeNull();
    expect(completedProgress.data?.completion).toBe(100);
    expect(completedProgress.data?.completed_at).toBeTruthy();

    // The development test account receives an isolated synthetic entitlement through
    // the existing verified-payment RPC. The browser still passes the real paid guard.
    const plan = await admin.from("billing_plans").select("id").eq("code", "monthly").single();
    if (plan.error) throw new Error("Hosted visual billing plan unavailable");
    const price = await admin
      .from("billing_price_versions")
      .select("id,version_code,amount_kobo,currency,interval")
      .eq("plan_id", plan.data.id)
      .eq("enabled", true)
      .single();
    if (price.error) throw new Error("Hosted visual billing price unavailable");
    const checkout = await admin
      .from("billing_checkout_intents")
      .insert({
        user_id: userId,
        price_version_id: price.data.id,
        internal_plan_code: "monthly",
        price_version_code: price.data.version_code,
        provider_plan_code: "PLN_onboarding_visual",
        provider_reference: `WF${testId.replaceAll("-", "")}`,
        idempotency_key: crypto.randomUUID(),
        amount_kobo: price.data.amount_kobo,
        currency: price.data.currency,
        interval: price.data.interval,
        status: "initialized",
        authorization_url: "https://checkout.paystack.com/synthetic",
        initialized_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (checkout.error) throw new Error("Could not create hosted visual checkout");
    const payment = await admin.rpc("phase12_record_verified_payment", {
      candidate_user_id: userId,
      candidate_checkout_intent_id: checkout.data.id,
      candidate_provider_transaction_id: `TX_${testId}`,
      candidate_provider_customer_code: `CUS_${testId}`,
      candidate_provider_subscription_code: "",
      candidate_paid_at: new Date(Date.now() - 60_000).toISOString(),
    });
    if (payment.error) throw new Error("Could not verify hosted visual test entitlement");

    const finalProgress = await admin
      .from("onboarding_progress")
      .select("completion")
      .eq("user_id", userId)
      .single();
    expect(finalProgress.error).toBeNull();
    expect(finalProgress.data?.completion).toBe(100);

    await page.goto("/dashboard");
    await expect(page.getByText("Preview mode")).toHaveCount(0);
    await expect(page.getByText(/good morning, wayfound/i)).toBeVisible();
    await expect(page.getByText(/amara/i)).toHaveCount(0);
    await expect(
      page.locator(".getting-started-list li.is-complete").filter({
        has: page.getByRole("link", { name: "Confirm your Passport" }),
      }),
    ).toBeVisible();
    await expect(page.getByText("Match score not available yet").first()).toBeVisible();
    const walkthrough = page.getByRole("dialog", { name: /your home base/i });
    await expect(walkthrough).toBeVisible();
    await walkthrough.getByRole("button", { name: "Skip" }).click();
    await expect(walkthrough).toHaveCount(0);
    if (focus === "exploring")
      await expect(
        mobile
          ? page.getByRole("link", { name: /choose a path to unlock tailored matches/i })
          : page.getByRole("heading", { name: /choose a path to unlock tailored matches/i }),
      ).toBeVisible();
    await capture(
      page,
      focus === "exploring"
        ? "dashboard-after-still-exploring-completion"
        : "dashboard-after-single-focus-completion",
      project,
    );
  } finally {
    await context.close();
    const removed = await admin.auth.admin.deleteUser(userId);
    if (removed.error) throw new Error("Could not clean up hosted visual test user");
  }
}

test("@visual hosted dashboards use real user state and published opportunities", async ({
  browser,
}, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name));
  test.skip(!hostedEvidenceAvailable, "Hosted development project credentials are required");
  test.setTimeout(240_000);
  await captureHostedDashboard(browser, testInfo.project.name, "academic");
  await captureHostedDashboard(browser, testInfo.project.name, "exploring");
});
