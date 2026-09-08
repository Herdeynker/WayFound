import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getCurrentUser, hasCurrentRequiredConsent } from "@/server/auth/service";
import { isTestFixtureRequest } from "@/server/auth/guards";

export default async function HomePage() {
  if (await isTestFixtureRequest()) redirect("/dashboard");
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/login");
  if (!(await hasCurrentRequiredConsent(client, user.id))) redirect("/consent");
  const { data: progress } = await client
    .from("onboarding_progress")
    .select("completion")
    .eq("user_id", user.id)
    .maybeSingle();
  redirect(progress && progress.completion > 0 ? "/dashboard" : "/onboarding");
}
