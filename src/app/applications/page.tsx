import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { ApplicationTracker } from "@/features/applications/application-tracker";
import { phase9Applications } from "@/features/applications/fixture";
import { getApplications } from "@/server/applications/queries";
import type { Phase9FixtureState } from "@/features/applications/application-tracker";

const fixtureStates = new Set<Phase9FixtureState>([
  "default",
  "empty",
  "loading",
  "error",
  "permission",
  "completed",
]);

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (await isTestFixtureRequest()) {
    const { state } = await searchParams;
    const fixtureState = fixtureStates.has(state as Phase9FixtureState)
      ? (state as Phase9FixtureState)
      : "default";
    const applications = fixtureState === "empty" ? [] : phase9Applications;
    return (
      <ApplicationTracker
        fixtureState={fixtureState}
        initial={
          fixtureState === "completed"
            ? applications.map((application) => ({
                ...application,
                checklistDone: application.checklistTotal,
                status: "accepted" as const,
              }))
            : applications
        }
      />
    );
  }
  const { client, user } = await requireConsentedUser();
  if (!user) return null;
  return <ApplicationTracker initial={await getApplications(client, user.id)} />;
}
