import { notFound } from "next/navigation";
import { isTestFixtureRequest } from "@/server/auth/guards";
import {
  DiscoveryOperationsPanel,
  type DiscoveryOperationsState,
} from "@/features/discovery/operations-panel";

const states = new Set<DiscoveryOperationsState>(["ready", "disabled", "quota-exhausted", "empty", "error"]);

export default async function DiscoveryOperationsEvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (!(await isTestFixtureRequest())) notFound();
  const requested = (await searchParams).state as DiscoveryOperationsState | undefined;
  return <DiscoveryOperationsPanel state={requested && states.has(requested) ? requested : "ready"} />;
}
