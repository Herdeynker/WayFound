import type { FeedResult, OpportunityCardModel } from "@/server/opportunity-experience/query";

const cards: OpportunityCardModel[] = [
  {
    id: "demo-scholarship",
    matchId: "demo-match-1",
    title: "Global Technology Scholarship",
    organization: "Northbridge University",
    destination: "Canada",
    type: "Scholarship",
    deadline: "2026-11-20",
    rollingDeadline: false,
    matchScore: 92,
    eligibility: "eligible",
    readiness: "ready",
    sponsorship: "Sponsorship not stated",
    decision: "allow",
    reason: "Your academic pathway and destination preference align.",
    saved: false,
    dismissed: false,
    lastCheckedAt: "2026-09-08T10:00:00.000Z",
  },
  {
    id: "demo-professional",
    matchId: "demo-match-2",
    title: "Software Engineer",
    organization: "Meridian Systems",
    destination: "Germany",
    type: "Professional role",
    deadline: "2027-01-15",
    rollingDeadline: false,
    matchScore: 88,
    eligibility: "more_information_needed",
    readiness: "missing",
    sponsorship: "Employer capability only — not vacancy confirmation",
    decision: "limited",
    reason: "Add your language-test information to complete this evaluation.",
    saved: false,
    dismissed: false,
    lastCheckedAt: "2026-09-07T10:00:00.000Z",
  },
  {
    id: "demo-trade",
    matchId: "demo-match-3",
    title: "Industrial Electrician",
    organization: "Maple Works",
    destination: "Canada",
    type: "Skilled trade",
    deadline: null,
    rollingDeadline: true,
    matchScore: 85,
    eligibility: "manual_confirmation_required",
    readiness: "in_progress",
    sponsorship: "Vacancy visa support indicated",
    decision: "limited",
    reason: "Confirm your trade licence before treating this as actionable.",
    saved: false,
    dismissed: false,
    lastCheckedAt: "2026-09-06T10:00:00.000Z",
  },
];

export function phase8FixtureFeed(): FeedResult {
  return { items: cards, page: 1, hasMore: false, state: "ready" };
}
export function phase8FixtureDetail(id: string) {
  const card = cards.find((item) => item.id === id) ?? cards[0];
  return {
    card,
    requirements: [
      {
        requirement_category: "education_level",
        requirement_strength: "hard",
        outcome: "met",
        explanation: "Your confirmed Passport contains the required qualification level.",
      },
      {
        requirement_category: "language",
        requirement_strength: "hard",
        outcome: card.eligibility === "more_information_needed" ? "unknown" : "met",
        explanation:
          card.eligibility === "more_information_needed"
            ? "Language information is still needed."
            : "Language information is available.",
      },
    ],
    readiness: [
      {
        item_key: "passport",
        document_type: "passport",
        state: card.readiness,
        explanation: "Document readiness reflects preparation, not official validity.",
      },
    ],
    action: {
      id: "demo-action",
      action_type: "complete_passport_field",
      priority: 80,
      status: "pending",
      title: "Complete your language information",
      explanation: "This is needed to finish the eligibility evaluation.",
      due_at: card.deadline,
    },
    reasons: [
      { reason_type: "match_factor", message: card.reason ?? "Your Passport aligns with this opportunity." },
    ],
  };
}
