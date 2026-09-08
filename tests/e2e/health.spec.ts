import { expect, test } from "@playwright/test";

test("health endpoint is available on every configured viewport", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as Record<string, unknown>;
  expect(body.status).toBe("ok");
  expect(body).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
  expect(body).not.toHaveProperty("connectionString");
});
