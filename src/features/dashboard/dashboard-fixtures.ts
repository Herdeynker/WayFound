export type OpportunityCategory = "Scholarship" | "Job" | "Skilled Work";

export type OpportunityFixture = {
  id: string;
  title: string;
  category: OpportunityCategory;
  country: string;
  match: number;
  deadline: string;
  deadlineLabel: string;
  artwork: "china" | "germany" | "canada";
};

export type DashboardFixture = {
  user: { firstName: string; avatarLabel: string };
  readiness: { percentage: number; label: string };
  nextAction: { label: string; title: string; description: string };
  applications: { count: number; label: string; description: string };
  ielts: { score: string; label: string; description: string };
  opportunities: readonly OpportunityFixture[];
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
      title: "Chinese Government Scholarship",
      category: "Scholarship",
      country: "China",
      match: 92,
      deadline: "20 Nov 2024",
      deadlineLabel: "Fixture deadline",
      artwork: "china",
    },
    {
      id: "fixture-germany-engineer",
      title: "Software Engineer",
      category: "Job",
      country: "Germany",
      match: 88,
      deadline: "15 Jan 2025",
      deadlineLabel: "Fixture deadline",
      artwork: "germany",
    },
    {
      id: "fixture-canada-skilled-worker",
      title: "Skilled Worker",
      category: "Skilled Work",
      country: "Canada",
      match: 85,
      deadline: "28 Feb 2025",
      deadlineLabel: "Fixture deadline",
      artwork: "canada",
    },
  ],
};
