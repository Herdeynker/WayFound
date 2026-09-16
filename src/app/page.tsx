import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getCurrentUser, hasCurrentRequiredConsent } from "@/server/auth/service";
import { isTestFixtureRequest } from "@/server/auth/guards";
import { hasCompletedPassport } from "@/server/passport/service";
import { hasPaidEntitlement } from "@/server/billing/service";

export default async function HomePage() {
  if (await isTestFixtureRequest()) redirect("/dashboard");
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/login");
  if (!(await hasCurrentRequiredConsent(client, user.id))) redirect("/consent");
  if (!(await hasCompletedPassport(client, user.id))) redirect("/onboarding");
  if (!(await hasPaidEntitlement(user.id))) redirect("/pricing?onboarding=complete");
  redirect("/dashboard");
}
