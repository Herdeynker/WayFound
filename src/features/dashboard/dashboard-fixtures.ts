export type OpportunityCategory = "Scholarship" | "Job" | "Skilled Work";

export type OpportunityFixture = {
  id: string;
  matchId: string | null;
  source: "fixture" | "live";
  title: string;
  category: OpportunityCategory | string;
  country: string;
  match: number | null;
  basis?: "personalized" | "goal_related" | "explore";
  deadline: string;
  deadlineLabel: string;
  imageSrc?: string;
  imageAlt: string;
  saved: boolean;
};

export type DashboardFixture = {
  user: { firstName: string; avatarLabel: string };
  readiness: { percentage: number; label: string };
  nextAction: { label: string; title: string; description: string };
  applications: { count: number; label: string; description: string };
  ielts: { score: string; label: string; description: string };
  opportunities: readonly OpportunityFixture[];
  discoveryHeading?: string;
  checklist: {
    dismissed: boolean;
    collapsed: boolean;
    items: Array<{ id: string; label: string; href: string; complete: boolean }>;
  };
  walkthrough: { version: string; completed: boolean; dismissed: boolean };
};

/** Static Phase 1 view models. Phase 8 can replace this boundary with server data. */
export const dashboardFixture: DashboardFixture = {
  user: { firstName: "Amara", avatarLabel: "A" },
  readiness: { percentage: 78, label: "ready" },
  nextAction: {
    label: "Next Best Action",
    title: "Complete your profile",
    description: "A complete profile helps you get better matches and more opportunities.",
  },
  applications: { count: 2, label: "active", description: "Track your progress towards your goals." },
  ielts: {
    score: "Band 6.5",
    label: "IELTS Practice",
    description: "Keep practicing to unlock more opportunities.",
  },
  opportunities: [
    {
      id: "fixture-china-scholarship",
      matchId: "fixture-match-china-scholarship",
      source: "fixture",
      title: "Chinese Government Scholarship",
      category: "Scholarship",
      country: "China",
      match: 92,
      deadline: "20 Nov 2024",
      deadlineLabel: "Deadline",
      imageSrc: "/images/destinations/beijing-tiananmen.jpg",
      imageAlt: "Tiananmen Gate in Beijing, China",
      saved: false,
    },
    {
      id: "fixture-germany-engineer",
      matchId: "fixture-match-germany-engineer",
      source: "fixture",
      title: "Software Engineer",
      category: "Job",
      country: "Germany",
      match: 88,
      deadline: "15 Jan 2025",
      deadlineLabel: "Deadline",
      imageSrc: "/images/destinations/berlin-brandenburg-gate.jpg",
      imageAlt: "Brandenburg Gate in Berlin, Germany",
      saved: false,
    },
    {
      id: "fixture-canada-skilled-worker",
      matchId: "fixture-match-canada-skilled-worker",
      source: "fixture",
      title: "Skilled Worker",
      category: "Skilled Work",
      country: "Canada",
      match: 85,
      deadline: "28 Feb 2025",
      deadlineLabel: "Deadline",
      imageSrc: "/images/destinations/toronto-skyline.jpg",
      imageAlt: "Toronto skyline in Ontario, Canada",
      saved: false,
    },
  ],
  checklist: {
    dismissed: false,
    collapsed: false,
    items: [
      { id: "account", label: "Create your account", href: "/settings/account", complete: true },
      { id: "goals", label: "Choose relocation goals", href: "/onboarding", complete: false },
      { id: "passport", label: "Confirm your Passport", href: "/onboarding", complete: false },
      { id: "match", label: "Review your first match", href: "/opportunities", complete: false },
      { id: "save", label: "Save an opportunity", href: "/opportunities", complete: false },
      { id: "cv", label: "Upload a CV", href: "/applications", complete: false },
      {
        id: "alerts",
        label: "Configure notification preferences",
        href: "/settings/notifications",
        complete: false,
      },
    ],
  },
  walkthrough: { version: "v1", completed: true, dismissed: false },
};
