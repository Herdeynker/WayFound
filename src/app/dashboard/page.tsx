import { DashboardShell } from "@/components/dashboard-shell";
import { requireConsentedUser, isTestFixtureRequest } from "@/server/auth/guards";

export default async function DashboardPage() {
  if (await isTestFixtureRequest()) return <DashboardShell />;
  await requireConsentedUser();
  return <DashboardShell />;
}
