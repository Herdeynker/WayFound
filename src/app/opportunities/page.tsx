import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { getOpportunityFeed, parseFeedQuery } from "@/server/opportunity-experience/query";
import { phase8FixtureFeed } from "@/features/opportunities/fixture";
import { FeedError, OpportunityFeed } from "@/features/opportunities/opportunity-experience";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseFeedQuery(await searchParams);
  if (!parsed.success) return <FeedError />;
  const query = Object.fromEntries(
    Object.entries(parsed.data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  if (await isTestFixtureRequest())
    return <OpportunityFeed initial={phase8FixtureFeed(parsed.data)} query={query} />;
  const { client, user } = await requireConsentedUser();
  if (!user) return null;
  try {
    return <OpportunityFeed initial={await getOpportunityFeed(client, user.id, parsed.data)} query={query} />;
  } catch {
    return <FeedError />;
  }
}
