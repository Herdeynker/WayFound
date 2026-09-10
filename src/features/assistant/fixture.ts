import type { AssistantSourceFact } from "./types";
import type { AssistantSummary } from "./workspace";

export const phase10Application = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Global Technology Scholarship",
};

export const phase10Facts: AssistantSourceFact[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    category: "passport" as const,
    label: "Confirmed qualification",
    value: "BSc Computer Science",
    evidenceLabel: "Confirmed Opportunity Passport",
    approved: true as const,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    category: "user_evidence" as const,
    label: "Relevant experience",
    value: "Built and maintained accessible web applications",
    evidenceLabel: "User-provided evidence",
    approved: true as const,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    category: "opportunity" as const,
    label: "Selected opportunity",
    value: "Global Technology Scholarship",
    evidenceLabel: "Selected application workspace",
    approved: true as const,
  },
];

export const phase10Summary: AssistantSummary = {
  analyses: [{ id: "analysis-demo", alignmentScore: 72, createdAt: "2026-09-10T09:00:00.000Z" }],
  drafts: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Motivation letter for Global Technology Scholarship",
      kind: "motivation_letter",
      status: "draft",
      updatedAt: "2026-09-10T09:10:00.000Z",
      revisionId: "33333333-3333-4333-8333-333333333333",
      approvedRevisionId: "",
    },
  ],
};
