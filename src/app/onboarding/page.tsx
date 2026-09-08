import { PassportWizard } from "@/features/passport/passport-wizard";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";

export default async function OnboardingPage() {
  if (await isTestFixtureRequest()) return <PassportWizard fixture />;
  await requireConsentedUser();
  return <PassportWizard />;
}
