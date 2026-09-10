import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { DocumentLibrary } from "@/features/applications/application-tracker";
import { phase9Documents } from "@/features/applications/fixture";
import { getDocumentLibrary } from "@/server/applications/queries";
import type { Phase9FixtureState } from "@/features/applications/application-tracker";

const fixtureStates = new Set<Phase9FixtureState>([
  "default",
  "empty",
  "loading",
  "success",
  "error",
  "interrupted",
  "permission",
]);

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (await isTestFixtureRequest()) {
    const { state } = await searchParams;
    const fixtureState = fixtureStates.has(state as Phase9FixtureState)
      ? (state as Phase9FixtureState)
      : "default";
    return (
      <DocumentLibrary
        fixtureState={fixtureState}
        initial={fixtureState === "empty" ? [] : phase9Documents}
      />
    );
  }
  const { client, user } = await requireConsentedUser();
  if (!user) return null;
  return <DocumentLibrary initial={await getDocumentLibrary(client, user.id)} />;
}
