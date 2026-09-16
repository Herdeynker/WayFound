import "server-only";

import type { User } from "@supabase/supabase-js";
import type { DashboardFixture, OpportunityFixture } from "@/features/dashboard/dashboard-fixtures";
import type { WayfoundSupabaseClient } from "@/server/supabase/types";
import { getOpportunityFeed } from "@/server/opportunity-experience/query";

function nameFromAccount(
  user: User,
  profile: { first_name: string | null; display_name: string | null } | null,
) {
  const candidate =
    profile?.display_name?.trim() ||
    profile?.first_name?.trim() ||
    (typeof user.user_metadata.first_name === "string" ? user.user_metadata.first_name.trim() : "") ||
    user.email?.split("@")[0]?.trim() ||
    "there";
  return candidate.split(/\s+/)[0] || "there";
}

function formatDeadline(deadline: string | null, rolling: boolean) {
  if (rolling) return { label: "Deadline", value: "Rolling" };
  if (!deadline) return { label: "Deadline", value: "Not stated" };
  return {
    label: "Deadline",
    value: new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(`${deadline}T00:00:00`),
    ),
  };
}

export async function getDashboardModel(
  client: WayfoundSupabaseClient,
  user: User,
): Promise<DashboardFixture> {
  const [
    profile,
    progress,
    applications,
    feed,
    goals,
    version,
    document,
    notifications,
    walkthrough,
    checklist,
  ] = await Promise.all([
    client.from("profiles").select("first_name,display_name").eq("id", user.id).maybeSingle(),
    client
      .from("onboarding_progress")
      .select("completion,passport_readiness")
      .eq("user_id", user.id)
      .maybeSingle(),
    client.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    getOpportunityFeed(client, user.id, { sort: "best", tab: "for_you", page: 1 }).catch(() => null),
    client.from("user_goals").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    client.from("profile_versions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    client.from("document_metadata").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    client
      .from("notification_preferences")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", user.id),
    readPresentationState(client, user.id, "user_walkthrough_state"),
    readPresentationState(client, user.id, "user_checklist_state"),
  ]);
  const opportunities: OpportunityFixture[] = (feed?.items ?? []).slice(0, 3).map((item) => {
    const deadline = formatDeadline(item.deadline, item.rollingDeadline);
    return {
      id: item.id,
      matchId: item.matchId,
      source: "live",
      title: item.title,
      category: item.type,
      country: item.destination,
      match: item.matchScore,
      basis: item.basis,
      deadline: deadline.value,
      deadlineLabel: deadline.label,
      imageSrc: item.imageSrc ?? undefined,
      imageAlt: item.imageAlt ?? `${item.destination} destination`,
      saved: item.saved,
    };
  });
  const readiness = progress.data?.passport_readiness ?? progress.data?.completion ?? 0;
  const hasGoals = (goals.count ?? 0) > 0;
  const hasVersion = (version.count ?? 0) > 0;
  const hasMatch = Boolean(feed?.items.some((item) => item.basis === "personalized"));
  return {
    user: {
      firstName: nameFromAccount(user, profile.data),
      avatarLabel: nameFromAccount(user, profile.data),
    },
    readiness: { percentage: readiness, label: "ready" },
    nextAction:
      readiness < 100
        ? {
            label: "Next Best Action",
            title: "Complete your profile",
            description: "A complete profile helps you get better matches and more opportunities.",
          }
        : {
            label: "Next Best Action",
            title: "Explore your matches",
            description: "Your profile is ready. Review opportunities matched to your confirmed information.",
          },
    applications: {
      count: applications.count ?? 0,
      label: "active",
      description: "Track your progress towards your goals.",
    },
    ielts: {
      score: "Start practice",
      label: "IELTS Practice",
      description: "Build language readiness for opportunities that need it.",
    },
    opportunities,
    discoveryHeading: opportunities.some((item) => item.basis === "personalized")
      ? "Top Matches For You"
      : opportunities.some((item) => item.basis === "goal_related")
        ? "Based On Your Goals"
        : "Explore More Opportunities",
    checklist: {
      dismissed: Boolean(checklist?.dismissed_at),
      collapsed: Boolean(checklist?.collapsed_at),
      items: [
        { id: "account", label: "Create your account", href: "/settings/account", complete: true },
        {
          id: "goals",
          label: "Choose relocation goals",
          href: "/onboarding?edit=1",
          complete: hasGoals,
        },
        {
          id: "passport",
          label: "Confirm your Passport",
          href: "/onboarding?edit=1",
          complete: hasVersion && readiness === 100,
        },
        { id: "match", label: "Review your first match", href: "/opportunities", complete: hasMatch },
        {
          id: "save",
          label: "Save an opportunity",
          href: "/opportunities",
          complete: opportunities.some((item) => item.saved),
        },
        { id: "cv", label: "Upload a CV", href: "/applications", complete: (document.count ?? 0) > 0 },
        {
          id: "alerts",
          label: "Configure notification preferences",
          href: "/settings/notifications",
          complete: (notifications.count ?? 0) > 0,
        },
      ],
    },
    walkthrough: {
      version: "v1",
      completed: Boolean(walkthrough?.completed_at),
      dismissed: Boolean(walkthrough?.dismissed_at),
    },
  };
}

async function readPresentationState(client: unknown, userId: string, table: string) {
  const result = await (
    client as {
      from(name: string): {
        select(columns: string): {
          eq(
            column: string,
            value: string,
          ): { maybeSingle(): Promise<{ data: Record<string, string | null> | null; error: unknown }> };
        };
      };
    }
  )
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return result.error ? null : result.data;
}
