import type { AssistantState } from "@/features/assistant/workspace";
import { AssistantWorkspace } from "@/features/assistant/workspace";
import { phase10Application, phase10Facts, phase10Summary } from "@/features/assistant/fixture";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { getAssistantContext, getAssistantSummary } from "@/server/assistant/service";

const fixtureStates = new Set<AssistantState>([
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

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (await isTestFixtureRequest()) {
    const requested = (await searchParams).state;
    const state = fixtureStates.has(requested as AssistantState) ? (requested as AssistantState) : "default";
    return (
      <AssistantWorkspace
        applications={state === "empty" ? [] : [phase10Application]}
        fixture
        initial={phase10Summary}
        sourceFacts={phase10Facts}
        state={state}
      />
    );
  }
  const { client, user } = await requireConsentedUser();
  if (!user) return null;
  const context = await getAssistantContext(user.id);
  return (
    <AssistantWorkspace
      applications={context.applications}
      initial={await getAssistantSummary(client, user.id)}
      sourceFacts={context.sourceFacts}
    />
  );
}
