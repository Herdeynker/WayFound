import { PassportWizard } from "@/features/passport/passport-wizard";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { hasPaidEntitlement } from "@/server/billing/service";
import { hasCompletedPassport } from "@/server/passport/service";
import { redirect } from "next/navigation";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string; scenario?: string }>;
}) {
  const params = (await searchParams) ?? {};
  if (await isTestFixtureRequest()) {
    const scenarios = ["default", "saving", "error", "resumed", "permission"] as const;
    const scenario = scenarios.includes(params.scenario as (typeof scenarios)[number])
      ? (params.scenario as (typeof scenarios)[number])
      : "default";
    return <PassportWizard fixture fixtureScenario={scenario} />;
  }
  const { client, user } = await requireConsentedUser();
  if (!user) return null;
  const [completed, entitled] = await Promise.all([
    hasCompletedPassport(client, user.id),
    hasPaidEntitlement(user.id),
  ]);
  if (completed && params.edit !== "1") redirect(entitled ? "/dashboard" : "/pricing?onboarding=complete");
  return <PassportWizard afterConfirmHref={entitled ? "/dashboard" : undefined} enrichment={completed} />;
}
