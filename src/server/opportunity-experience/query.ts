import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { type OfficialApplicationAction, validateOfficialApplicationUrl } from "./application-link";
import { destinationMediaFor } from "@/features/opportunities/destination-media";
import { isGoalRelatedOpportunity, rankDiscoverySections } from "./ranking";

type Client = SupabaseClient<Database, "public">;
const pageSize = 12;

const stringFilter = z.string().trim().min(1).max(80).optional();
export const feedQuerySchema = z
  .object({
    q: z.string().trim().max(80).optional(),
    type: stringFilter,
    destination: z
      .string()
      .trim()
      .regex(/^[A-Za-z ]{2,80}$/)
      .optional(),
    outcome: z.enum(["eligible", "more_information_needed", "manual_confirmation_required"]).optional(),
    readiness: z.enum(["ready", "missing", "in_progress", "expired", "unknown", "conditional"]).optional(),
    sort: z.enum(["best", "deadline", "recent", "readiness"]).default("best"),
    tab: z.enum(["for_you", "latest", "closing_soon", "explore_all"]).default("for_you"),
    page: z.coerce.number().int().min(1).max(100).default(1),
  })
  .strict();
export type FeedQuery = z.infer<typeof feedQuerySchema>;

export type OpportunityCardModel = {
  id: string;
  matchId: string | null;
  title: string;
  organization: string;
  destination: string;
  type: string;
  deadline: string | null;
  rollingDeadline: boolean;
  matchScore: number | null;
  basis: "personalized" | "goal_related" | "explore";
  imageSrc: string | null;
  imageAlt: string | null;
  isClosingSoon: boolean;
  eligibility: string;
  readiness: string;
  sponsorship: string;
  decision: string;
  reason: string | null;
  saved: boolean;
  dismissed: boolean;
  lastCheckedAt: string | null;
  applicationUrl: string | null;
};

export type FeedResult = {
  items: OpportunityCardModel[];
  page: number;
  hasMore: boolean;
  state: "ready" | "passport_incomplete" | "matching_unavailable" | "empty" | "permission_denied";
};

type SafeOpportunity = {
  id: string | null;
  title: string | null;
  organization_name: string | null;
  destination_country: string | null;
  destination_country_code: string | null;
  opportunity_type: string | null;
  opportunity_type_code: string | null;
  application_deadline: string | null;
  rolling_deadline: boolean | null;
  sponsorship_status: string | null;
  last_checked_at: string | null;
  lifecycle_status: string | null;
  application_url: string | null;
  summary: string | null;
};

const labels: Record<string, string> = {
  explicitly_confirmed: "Vacancy sponsorship confirmed",
  strong_vacancy_indication: "Vacancy visa support indicated",
  possible_not_confirmed: "Sponsorship may be possible — verify wording",
  organization_capability_only: "Employer capability only — not vacancy confirmation",
  not_stated: "Sponsorship not stated",
  explicitly_unavailable: "Sponsorship not offered",
  conflicting: "Sponsorship information conflicts",
  insufficient_evidence: "Sponsorship information is limited",
};

function text(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function closingSoon(deadline: string | null, rolling: boolean | null | undefined) {
  if (!deadline || rolling) return false;
  const days = (Date.parse(`${deadline}T23:59:59Z`) - Date.now()) / 86_400_000;
  return days >= 0 && days <= 14;
}

function eventState(events: Array<{ match_evaluation_id: string | null; event_type: string }>) {
  const saved = new Set<string>();
  const dismissed = new Set<string>();
  for (const event of events) {
    if (!event.match_evaluation_id) continue;
    if (event.event_type === "match_saved") saved.add(event.match_evaluation_id);
    if (event.event_type === "match_unsaved") saved.delete(event.match_evaluation_id);
    if (event.event_type === "match_dismissed") dismissed.add(event.match_evaluation_id);
  }
  return { saved, dismissed };
}

async function applyOpportunityStates(
  client: Client,
  userId: string,
  items: OpportunityCardModel[],
): Promise<OpportunityCardModel[]> {
  const ids = [...new Set(items.map((item) => item.id))];
  if (!ids.length) return items;
  const result = await client
    .from("opportunity_user_states")
    .select("opportunity_id,state")
    .eq("user_id", userId)
    .in("opportunity_id", ids);
  if (result.error) throw new Error("We could not load your opportunity preferences.");
  const states = new Map((result.data ?? []).map((state) => [state.opportunity_id, state.state]));
  return items
    .filter((item) => states.get(item.id) !== "dismissed")
    .map((item) => ({ ...item, saved: states.get(item.id) === "saved" }));
}

function safeCard(
  opportunity: SafeOpportunity,
  basis: OpportunityCardModel["basis"],
): OpportunityCardModel | null {
  if (!opportunity.id || !opportunity.title) return null;
  const destination = text(opportunity.destination_country, opportunity.destination_country_code ?? "Global");
  const image = destinationMediaFor(destination);
  return {
    id: opportunity.id,
    matchId: null,
    title: opportunity.title,
    organization: text(opportunity.organization_name, "Organization not stated"),
    destination,
    type: text(opportunity.opportunity_type, opportunity.opportunity_type_code ?? "Opportunity"),
    deadline: opportunity.application_deadline,
    rollingDeadline: Boolean(opportunity.rolling_deadline),
    matchScore: null,
    eligibility: "unknown",
    readiness: "unknown",
    sponsorship: labels[opportunity.sponsorship_status ?? "not_stated"] ?? "Sponsorship not stated",
    decision: "allow",
    reason: basis === "goal_related" ? "Related to your selected goals or destinations." : null,
    saved: false,
    dismissed: false,
    lastCheckedAt: opportunity.last_checked_at,
    applicationUrl: opportunity.application_url,
    basis,
    imageSrc: image?.src ?? null,
    imageAlt: image?.alt ?? null,
    isClosingSoon: closingSoon(opportunity.application_deadline, opportunity.rolling_deadline),
  };
}

/** Maps only the safe view and owner-readable Phase 7 records into Phase 8 UI data. */
export async function getOpportunityFeed(
  client: Client,
  userId: string,
  input: FeedQuery,
): Promise<FeedResult> {
  const profile = await client
    .from("profile_versions")
    .select("id,snapshot")
    .eq("user_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (profile.error) throw new Error("We could not check your Opportunity Passport.");
  const hasProfile = Boolean(profile.data);
  const snapshot =
    profile.data?.snapshot &&
    typeof profile.data.snapshot === "object" &&
    !Array.isArray(profile.data.snapshot)
      ? (profile.data.snapshot as Record<string, unknown>)
      : {};
  const goals = Array.isArray(snapshot.selectedGoals)
    ? snapshot.selectedGoals.filter((value): value is string => typeof value === "string")
    : [];
  const destinations = Array.isArray(snapshot.destinations)
    ? snapshot.destinations.filter((value): value is string => typeof value === "string")
    : [];

  const classifyFallbacks = (rows: SafeOpportunity[]) => {
    const goalRelated: OpportunityCardModel[] = [];
    const explore: OpportunityCardModel[] = [];
    for (const row of rows) {
      const basis =
        hasProfile &&
        isGoalRelatedOpportunity({
          opportunityTypeCode: row.opportunity_type_code,
          destinationCountryCode: row.destination_country_code,
          goals,
          destinations,
        })
          ? "goal_related"
          : "explore";
      const card = safeCard(row, basis);
      if (card) (basis === "goal_related" ? goalRelated : explore).push(card);
    }
    return { goalRelated, explore };
  };

  const safeRows = async (limit = 100) => {
    const result = await client
      .from("safe_active_opportunities")
      .select(
        "id, title, organization_name, destination_country, destination_country_code, opportunity_type, opportunity_type_code, application_deadline, rolling_deadline, sponsorship_status, last_checked_at, lifecycle_status, application_url, summary",
      )
      .order(input.tab === "closing_soon" ? "application_deadline" : "last_checked_at", {
        ascending: input.tab === "closing_soon",
        nullsFirst: false,
      })
      .limit(limit);
    if (result.error) throw new Error("Verified opportunities are temporarily unavailable.");
    return (result.data ?? []) as SafeOpportunity[];
  };

  const matches = await client
    .from("match_evaluations")
    .select(
      "id, opportunity_id, candidate_rank, match_score, eligibility_outcome, readiness_state, publication_decision, evaluated_at",
    )
    .eq("user_id", userId)
    .eq("profile_version_id", profile.data?.id ?? "00000000-0000-0000-0000-000000000000")
    .in(
      "eligibility_outcome",
      input.outcome
        ? [input.outcome]
        : ["eligible", "more_information_needed", "manual_confirmation_required"],
    )
    .order("candidate_rank", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);
  if (matches.error) throw new Error("Your matches are temporarily unavailable.");
  const matchRows = matches.data ?? [];
  if (input.tab !== "for_you") {
    const classified = classifyFallbacks(await safeRows(100));
    const filtered =
      input.tab === "explore_all"
        ? [...classified.goalRelated, ...classified.explore].map((item) => ({
            ...item,
            basis: "explore" as const,
          }))
        : rankDiscoverySections([
            { basis: "goal_related", items: classified.goalRelated },
            { basis: "explore", items: classified.explore },
          ]);
    return paginateFeed(
      applyFilters(await applyOpportunityStates(client, userId, filtered), input),
      input.page,
    );
  }

  if (!matchRows.length) {
    const classified = classifyFallbacks(await safeRows(100));
    const ranked = rankDiscoverySections([
      { basis: "goal_related", items: classified.goalRelated },
      { basis: "explore", items: classified.explore },
    ]);
    const stateful = await applyOpportunityStates(client, userId, ranked);
    return {
      ...paginateFeed(applyFilters(stateful, input), input.page),
      state: stateful.length ? "ready" : hasProfile ? "empty" : "passport_incomplete",
    };
  }

  const matchIds = matchRows.map((item) => item.id);
  const opportunityIds = [...new Set(matchRows.map((item) => item.opportunity_id))];
  const [opportunities, reasons, events] = await Promise.all([
    client
      .from("safe_active_opportunities")
      .select(
        "id, title, organization_name, destination_country, destination_country_code, opportunity_type, opportunity_type_code, application_deadline, rolling_deadline, sponsorship_status, last_checked_at, lifecycle_status, application_url",
      )
      .in("id", opportunityIds),
    client
      .from("match_reasons")
      .select("match_evaluation_id, message, sort_order")
      .in("match_evaluation_id", matchIds)
      .order("sort_order", { ascending: true }),
    client
      .from("match_feedback_events")
      .select("match_evaluation_id, event_type, created_at")
      .eq("user_id", userId)
      .in("match_evaluation_id", matchIds)
      .order("created_at", { ascending: true }),
  ]);
  if (opportunities.error || reasons.error || events.error)
    throw new Error("We could not load safe opportunity details.");
  const safeById = new Map((opportunities.data ?? []).filter((row) => row.id).map((row) => [row.id!, row]));
  const reasonByMatch = new Map<string, string>();
  for (const reason of reasons.data ?? [])
    if (!reasonByMatch.has(reason.match_evaluation_id))
      reasonByMatch.set(reason.match_evaluation_id, reason.message);
  const states = eventState(events.data ?? []);
  const mapped: Array<OpportunityCardModel | null> = matchRows.map((match) => {
    const opportunity = safeById.get(match.opportunity_id);
    if (!opportunity || states.dismissed.has(match.id)) return null;
    const image = destinationMediaFor(
      text(opportunity.destination_country, opportunity.destination_country_code ?? "Global"),
    );
    return {
      id: opportunity.id!,
      matchId: match.id,
      title: text(opportunity.title, "Opportunity"),
      organization: text(opportunity.organization_name, "Organization not stated"),
      destination: text(opportunity.destination_country, opportunity.destination_country_code ?? "Global"),
      type: text(opportunity.opportunity_type, "Opportunity"),
      deadline: opportunity.application_deadline,
      rollingDeadline: Boolean(opportunity.rolling_deadline),
      matchScore: match.match_score,
      basis: "personalized",
      imageSrc: image?.src ?? null,
      imageAlt: image?.alt ?? null,
      isClosingSoon: closingSoon(opportunity.application_deadline, opportunity.rolling_deadline),
      eligibility: match.eligibility_outcome,
      readiness: match.readiness_state,
      sponsorship: labels[opportunity.sponsorship_status ?? "not_stated"] ?? "Sponsorship not stated",
      decision: match.publication_decision,
      reason: reasonByMatch.get(match.id) ?? null,
      saved: states.saved.has(match.id),
      dismissed: false as boolean,
      lastCheckedAt: opportunity.last_checked_at,
      applicationUrl: opportunity.application_url,
    } satisfies OpportunityCardModel;
  });
  let items: OpportunityCardModel[] = mapped.filter((item): item is OpportunityCardModel => item !== null);
  if (items.length < 3) {
    const classified = classifyFallbacks(
      (await safeRows(100)).filter((row) => !items.some((item) => item.id === row.id)),
    );
    items = rankDiscoverySections(
      [
        { basis: "personalized", items: items.filter((item) => item.basis === "personalized") },
        { basis: "goal_related", items: classified.goalRelated },
        { basis: "explore", items: classified.explore },
      ],
      100,
    );
    items = await applyOpportunityStates(client, userId, items);
  }
  return paginateFeed(applyFilters(items, input), input.page);
}

function applyFilters(items: OpportunityCardModel[], input: FeedQuery) {
  let filtered = items;
  if (input.q) {
    const query = input.q.toLocaleLowerCase();
    filtered = filtered.filter((item) =>
      `${item.title} ${item.organization} ${item.destination} ${item.type}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }
  if (input.type)
    filtered = filtered.filter((item) => item.type.toLocaleLowerCase() === input.type!.toLocaleLowerCase());
  if (input.destination)
    filtered = filtered.filter(
      (item) => item.destination.toLocaleLowerCase() === input.destination!.toLocaleLowerCase(),
    );
  if (input.readiness) filtered = filtered.filter((item) => item.readiness === input.readiness);
  if (input.outcome) filtered = filtered.filter((item) => item.eligibility === input.outcome);
  filtered.sort((a, b) => {
    if (input.sort === "deadline")
      return (
        (a.deadline ?? "9999-12-31").localeCompare(b.deadline ?? "9999-12-31") || a.id.localeCompare(b.id)
      );
    if (input.sort === "recent")
      return (b.lastCheckedAt ?? "").localeCompare(a.lastCheckedAt ?? "") || a.id.localeCompare(b.id);
    if (input.sort === "readiness")
      return (
        a.readiness.localeCompare(b.readiness) ||
        (b.matchScore ?? -1) - (a.matchScore ?? -1) ||
        a.id.localeCompare(b.id)
      );
    return (b.matchScore ?? -1) - (a.matchScore ?? -1) || a.id.localeCompare(b.id);
  });
  return filtered;
}

function paginateFeed(items: OpportunityCardModel[], page: number): FeedResult {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    hasMore: items.length > start + pageSize,
    state: items.length ? "ready" : "empty",
  };
}

export async function getOpportunityDetail(client: Client, userId: string, opportunityId: string) {
  const feed = await getOpportunityFeed(client, userId, { sort: "best", tab: "for_you", page: 1 });
  const card = feed.items.find((item) => item.id === opportunityId);
  if (!card) return null;
  if (!card.matchId)
    return {
      card,
      requirements: [],
      readiness: [],
      action: null,
      reasons: [
        {
          reason_type: "discovery_basis",
          message:
            card.basis === "goal_related"
              ? "This verified opportunity relates to your selected goals or destinations. Complete your Passport to calculate your match."
              : "This is a verified opportunity to explore. Complete your Passport to calculate your match.",
        },
      ],
      application: await getOfficialApplicationAction(card),
    };
  const [requirements, readiness, action, reasons] = await Promise.all([
    client
      .from("match_requirement_results")
      .select("requirement_category, requirement_strength, outcome, explanation")
      .eq("match_evaluation_id", card.matchId)
      .order("created_at"),
    client
      .from("match_readiness_items")
      .select("item_key, document_type, state, explanation")
      .eq("match_evaluation_id", card.matchId),
    client
      .from("match_next_actions")
      .select("id, action_type, priority, status, title, explanation, due_at")
      .eq("match_evaluation_id", card.matchId)
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("match_reasons")
      .select("reason_type, message")
      .eq("match_evaluation_id", card.matchId)
      .order("sort_order"),
  ]);
  if (requirements.error || readiness.error || action.error || reasons.error)
    throw new Error("We could not load this match explanation.");
  return {
    card,
    requirements: requirements.data ?? [],
    readiness: readiness.data ?? [],
    action: action.data,
    reasons: reasons.data ?? [],
    application: await getOfficialApplicationAction(card),
  };
}

type TrustedApplicationRecord = {
  application_url: string | null;
  organizations: { official_domain: string | null; verification_status: string } | null;
  opportunity_sources: Array<{
    active: boolean;
    is_primary: boolean;
    source_registry: {
      active: boolean;
      allowed_domains: string[];
      canonical_domain: string;
      is_allowed: boolean;
      is_fixture: boolean;
      trust_tier: number;
    } | null;
  }>;
};

async function getOfficialApplicationAction(card: OpportunityCardModel): Promise<OfficialApplicationAction> {
  if (card.decision !== "allow")
    return {
      available: false,
      reason: "This match needs more verification before an application link can be used.",
    };
  try {
    const admin = createSupabaseAdminClient();
    const result = await admin
      .from("opportunities")
      .select(
        "application_url, organizations(official_domain,verification_status), opportunity_sources(active,is_primary,source_registry(active,is_allowed,is_fixture,trust_tier,canonical_domain,allowed_domains))",
      )
      .eq("id", card.id)
      .maybeSingle();
    if (result.error || !result.data)
      return { available: false, reason: "The official application link is currently unavailable." };
    const record = result.data as unknown as TrustedApplicationRecord;
    const approvedDomains =
      record.organizations?.verification_status === "verified"
        ? [record.organizations.official_domain ?? ""]
        : [];
    for (const source of record.opportunity_sources ?? []) {
      const registry = source.source_registry;
      if (
        !source.active ||
        !source.is_primary ||
        !registry ||
        !registry.active ||
        !registry.is_allowed ||
        registry.is_fixture ||
        registry.trust_tier > 3
      )
        continue;
      approvedDomains.push(registry.canonical_domain, ...registry.allowed_domains);
    }
    return validateOfficialApplicationUrl(record.application_url ?? card.applicationUrl, approvedDomains);
  } catch {
    return { available: false, reason: "The official application link is currently unavailable." };
  }
}

export function parseFeedQuery(searchParams: Record<string, string | string[] | undefined>) {
  const raw = Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  return feedQuerySchema.safeParse(raw);
}
