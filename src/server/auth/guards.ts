import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isTestFixtureHeader, testAuthHeader } from "@/lib/auth/test-fixture";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getCurrentUser, hasCurrentRequiredConsent } from "./service";

export async function isTestFixtureRequest(): Promise<boolean> {
  const requestHeaders = await headers();
  return isTestFixtureHeader(requestHeaders.get(testAuthHeader));
}

export async function requireUser() {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user && !(await isTestFixtureRequest())) redirect("/login");
  return { client, user };
}

export async function requireConsentedUser() {
  const result = await requireUser();
  if (!result.user) return result;
  if (!(await hasCurrentRequiredConsent(result.client, result.user.id))) redirect("/consent");
  return result;
}
