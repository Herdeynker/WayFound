import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getCurrentUser, hasCurrentRequiredConsent } from "@/server/auth/service";
import { isTestFixtureRequest } from "@/server/auth/guards";

export default async function HomePage() {
  if (await isTestFixtureRequest()) redirect("/dashboard");
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/login");
  redirect((await hasCurrentRequiredConsent(client, user.id)) ? "/dashboard" : "/consent");
}
