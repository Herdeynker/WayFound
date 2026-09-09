import { notFound } from "next/navigation";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { getOpportunityDetail } from "@/server/opportunity-experience/query";
import { phase8FixtureDetail } from "@/features/opportunities/fixture";
import { OpportunityDetail } from "@/features/opportunities/opportunity-experience";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (await isTestFixtureRequest()) return <OpportunityDetail detail={phase8FixtureDetail(id)} />;
  const { client, user } = await requireConsentedUser();
  if (!user) return null;
  const detail = await getOpportunityDetail(client, user.id, id);
  if (!detail) notFound();
  return <OpportunityDetail detail={detail} />;
}
