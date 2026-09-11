export const ieltsTestTypes = ["academic", "general"] as const;
export type IeltsTestType = (typeof ieltsTestTypes)[number];
export type IeltsSkill = "reading" | "writing" | "speaking";

export type ReadingQuestion = { id: string; prompt: string; options: string[] };

export type IeltsContentView = {
  id: string;
  slug: string;
  testType: IeltsTestType | "both";
  skill: IeltsSkill;
  activityKind: "diagnostic" | "practice";
  title: string;
  instructions: string;
  durationSeconds: number;
  content: Record<string, unknown>;
  rubric: Record<string, unknown>;
  provenanceType: "original" | "licensed";
  provenanceTitle: string;
  provenanceAuthor: string;
  provenanceUrl: string | null;
  licenceStatus: "approved";
  contentVersion: number;
};

export type IeltsProfileView = {
  testType: IeltsTestType;
  targetBand: number;
  testDate: string | null;
  recordingRetentionDays: number;
};

export type IeltsAttemptView = {
  id: string;
  title: string;
  skill: IeltsSkill;
  status: "in_progress" | "interrupted" | "completed" | "abandoned";
  scoreRaw: number | null;
  scoreMax: number | null;
  estimatedBand: number | null;
  startedAt: string;
};

export type IeltsFeedbackView = {
  id: string;
  skill: "writing" | "speaking";
  estimatedBand: number;
  summary: string;
  strengths: string[];
  recommendations: string[];
  createdAt: string;
};

export type IeltsStudyPlanView = {
  headline: string;
  nextSteps: string[];
  minutesPerDay: number;
  weakAreas: IeltsSkill[];
};

export type IeltsResourceView = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  testType: IeltsTestType | "both";
};

export type IeltsOverview = {
  profile: IeltsProfileView | null;
  content: IeltsContentView[];
  attempts: IeltsAttemptView[];
  feedback: IeltsFeedbackView[];
  studyPlan: IeltsStudyPlanView | null;
  resources: IeltsResourceView[];
  providerConfigured: boolean;
};

export type IeltsViewState =
  | "default"
  | "loading"
  | "empty"
  | "success"
  | "error"
  | "interrupted"
  | "stale"
  | "permission"
  | "disabled"
  | "completed";
