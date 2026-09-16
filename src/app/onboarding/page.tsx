import { PassportWizard } from "@/features/passport/passport-wizard";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { hasPaidEntitlement } from "@/server/billing/service";

export default async function OnboardingPage() {
  if (await isTestFixtureRequest()) return <PassportWizard fixture />;
  const { user } = await requireConsentedUser();
  const afterConfirmHref = user && (await hasPaidEntitlement(user.id)) ? "/dashboard" : undefined;
  return <PassportWizard afterConfirmHref={afterConfirmHref} />;
}
