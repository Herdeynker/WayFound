export const draftKinds = [
  "tailored_cv",
  "cover_letter",
  "motivation_letter",
  "personal_statement",
  "essay",
  "study_plan",
  "impact_statement",
  "recruiter_message",
] as const;
export type DraftKind = (typeof draftKinds)[number];

export const draftTones = ["clear", "confident", "warm", "formal", "concise"] as const;
export type DraftTone = (typeof draftTones)[number];

export type AssistantSourceFact = {
  id: string;
  category: "passport" | "cv" | "opportunity" | "user_evidence";
  label: string;
  value: string;
  evidenceLabel: string;
  evidenceUrl?: string;
  approved: true;
};
