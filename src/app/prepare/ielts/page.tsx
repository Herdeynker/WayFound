import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { IeltsPractice } from "@/features/ielts/ielts-practice";
import { phase13Fixture } from "@/features/ielts/fixture";
import type { IeltsViewState } from "@/features/ielts/types";
import { getIeltsOverview } from "@/server/ielts/service";

const fixtureStates = new Set<IeltsViewState>([
  "default",
  "loading",
  "empty",
  "success",
  "error",
  "interrupted",
  "stale",
  "permission",
  "disabled",
  "completed",
]);

export default async function IeltsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (await isTestFixtureRequest()) {
    const requested = (await searchParams).state;
    const state = fixtureStates.has(requested as IeltsViewState) ? (requested as IeltsViewState) : "default";
    return (
      <IeltsPractice
        fixture
        overview={{
          ...phase13Fixture,
          profile: state === "empty" ? null : phase13Fixture.profile,
          attempts: state === "empty" ? [] : phase13Fixture.attempts,
          feedback: state === "empty" ? [] : phase13Fixture.feedback,
          studyPlan: state === "empty" ? null : phase13Fixture.studyPlan,
          providerConfigured: state !== "disabled",
        }}
        state={state}
      />
    );
  }
  const { client, user } = await requireConsentedUser();
  if (!user) return null;
  return <IeltsPractice overview={await getIeltsOverview(client, user.id)} />;
}
