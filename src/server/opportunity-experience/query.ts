import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { type OfficialApplicationAction, validateOfficialApplicationUrl } from "./application-link";

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
    page: z.coerce.number().int().min(1).max(100).default(1),
  })
  .strict();
export type FeedQuery = z.infer<typeof feedQuerySchema>;

export type OpportunityCardModel = {
  id: string;
  matchId: string;
  title: string;
  organization: string;
  destination: string;
  type: string;
  deadline: string | null;
  rollingDeadline: boolean;
  matchScore: number;
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

/** Maps only the safe view and owner-readable Phase 7 records into Phase 8 UI data. */
export async function getOpportunityFeed(
  client: Client,
  userId: string,
  input: FeedQuery,
): Promise<FeedResult> {
  const profile = await client.from("profile_versions").select("id").eq("user_id", userId).limit(1);
  if (profile.error) throw new Error("We could not check your Opportunity Passport.");
  if (!profile.data?.length)
    return { items: [], page: input.page, hasMore: false, state: "passport_incomplete" };

  const matches = await client
    .from("match_evaluations")
    .select(
      "id, opportunity_id, candidate_rank, match_score, eligibility_outcome, readiness_state, publication_decision, evaluated_at",
    )
    .eq("user_id", userId)
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
  if (!matches.data?.length)
    return { items: [], page: input.page, hasMore: false, state: "matching_unavailable" };

  const matchIds = matches.data.map((item) => item.id);
  const opportunityIds = [...new Set(matches.data.map((item) => item.opportunity_id))];
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
  const mapped: Array<OpportunityCardModel | null> = matches.data.map((match) => {
    const opportunity = safeById.get(match.opportunity_id);
    if (!opportunity || states.dismissed.has(match.id)) return null;
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
  if (input.q) {
    const query = input.q.toLocaleLowerCase();
    items = items.filter((item) =>
      `${item.title} ${item.organization} ${item.destination} ${item.type}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }
  if (input.type)
    items = items.filter((item) => item.type.toLocaleLowerCase() === input.type!.toLocaleLowerCase());
  if (input.destination)
    items = items.filter(
      (item) => item.destination.toLocaleLowerCase() === input.destination!.toLocaleLowerCase(),
    );
  if (input.readiness) items = items.filter((item) => item.readiness === input.readiness);
  items.sort((a, b) => {
    if (input.sort === "deadline")
      return (
        (a.deadline ?? "9999-12-31").localeCompare(b.deadline ?? "9999-12-31") || a.id.localeCompare(b.id)
      );
    if (input.sort === "recent")
      return (b.lastCheckedAt ?? "").localeCompare(a.lastCheckedAt ?? "") || a.id.localeCompare(b.id);
    if (input.sort === "readiness")
      return (
        a.readiness.localeCompare(b.readiness) || b.matchScore - a.matchScore || a.id.localeCompare(b.id)
      );
    return b.matchScore - a.matchScore || a.id.localeCompare(b.id);
  });
  const start = (input.page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: input.page,
    hasMore: items.length > start + pageSize,
    state: items.length ? "ready" : "empty",
  };
}

export async function getOpportunityDetail(client: Client, userId: string, opportunityId: string) {
  const feed = await getOpportunityFeed(client, userId, { sort: "best", page: 1 });
  const card = feed.items.find((item) => item.id === opportunityId);
  if (!card) return null;
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
  organizations: { official_domain: string | null } | null;
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
        "application_url, organizations(official_domain), opportunity_sources(active,is_primary,source_registry(active,is_allowed,is_fixture,trust_tier,canonical_domain,allowed_domains))",
      )
      .eq("id", card.id)
      .maybeSingle();
    if (result.error || !result.data)
      return { available: false, reason: "The official application link is currently unavailable." };
    const record = result.data as unknown as TrustedApplicationRecord;
    const approvedDomains = [record.organizations?.official_domain ?? ""];
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
