import { z } from "zod";

export const goalTypes = [
  "study_funding",
  "fellowship_graduate",
  "research",
  "internship",
  "professional_sponsorship",
  "skilled_trade",
] as const;

export type GoalType = (typeof goalTypes)[number];

export const goalCatalog: Array<{ id: GoalType; title: string; description: string; eyebrow: string }> = [
  {
    id: "study_funding",
    title: "Study and scholarship funding",
    description: "Find routes that support your next qualification.",
    eyebrow: "Study",
  },
  {
    id: "fellowship_graduate",
    title: "Fellowships and graduate programmes",
    description: "Build an academic or research-led next step.",
    eyebrow: "Graduate",
  },
  {
    id: "research",
    title: "Research opportunities",
    description: "Surface research-focused programmes and placements.",
    eyebrow: "Research",
  },
  {
    id: "internship",
    title: "Internships",
    description: "Prepare for early-career opportunities and placements.",
    eyebrow: "Early career",
  },
  {
    id: "professional_sponsorship",
    title: "Professional jobs with sponsorship",
    description: "Describe experience for sponsored professional roles.",
    eyebrow: "Professional",
  },
  {
    id: "skilled_trade",
    title: "Skilled or trade work with sponsorship",
    description: "Capture practical experience and licensing context.",
    eyebrow: "Skilled work",
  },
];

export const countryOptions = [
  ["CN", "China"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["DE", "Germany"],
  ["IE", "Ireland"],
  ["NL", "Netherlands"],
  ["US", "United States"],
  ["NZ", "New Zealand"],
] as const;

export const sectionIds = [
  "goals",
  "origin",
  "destinations",
  "academic",
  "professional",
  "skills",
  "certifications",
  "trade",
  "language",
  "documents",
  "review",
] as const;
export type SectionId = (typeof sectionIds)[number];

export function visibleSections(goals: readonly GoalType[]): SectionId[] {
  const sections: SectionId[] = ["goals", "origin", "destinations"];
  const academic = goals.some((goal) =>
    ["study_funding", "fellowship_graduate", "research", "internship"].includes(goal),
  );
  const professional = goals.some((goal) => ["professional_sponsorship", "internship"].includes(goal));
  const trade = goals.includes("skilled_trade");
  if (academic) sections.push("academic");
  if (professional) sections.push("professional");
  if (professional || trade) sections.push("skills");
  if (academic || professional || trade) sections.push("certifications");
  if (trade) sections.push("trade");
  sections.push("language", "documents", "review");
  return sections;
}

const dateText = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, "Use a year or YYYY-MM-DD.")
  .or(z.literal(""));
const optionalNumber = z.number().finite().nonnegative().optional().nullable();

export const educationRecordSchema = z
  .object({
    id: z.string().uuid().optional(),
    institution: z.string().max(160),
    country: z.string().max(80),
    qualificationLevel: z.string().max(80),
    fieldOfStudy: z.string().max(160),
    startDate: dateText,
    completionDate: dateText,
    graduationStatus: z.enum(["completed", "awaiting_graduation", "currently_studying", "result_pending"]),
    gradeClassification: z.string().max(80),
    gpaValue: optionalNumber,
    gpaScale: optionalNumber,
    resultPending: z.boolean(),
    expectedGraduationDate: dateText,
    transcriptAvailable: z.boolean().nullable(),
    researchExperience: z.string().max(1200),
    publications: z.string().max(1200),
    academicAwards: z.string().max(1200),
  })
  .strict();

export const employmentRecordSchema = z
  .object({
    id: z.string().uuid().optional(),
    employer: z.string().max(160),
    jobTitle: z.string().max(160),
    country: z.string().max(80),
    employmentType: z.string().max(80),
    startDate: dateText,
    endDate: dateText,
    currentlyEmployed: z.boolean(),
    responsibilities: z.string().max(1600),
    achievements: z.string().max(1600),
    industry: z.string().max(120),
    occupationCategory: z.string().max(120),
    managementExperience: z.boolean().nullable(),
    remoteInternationalExperience: z.boolean().nullable(),
  })
  .strict();

export const skillSchema = z
  .object({
    id: z.string().uuid().optional(),
    skillName: z.string().trim().min(1).max(100),
    normalizedName: z.string().trim().min(1).max(100),
    category: z.string().max(80),
    proficiency: z.enum(["beginner", "developing", "proficient", "advanced"]),
    yearsExperience: optionalNumber,
    evidence: z.string().max(500),
  })
  .strict();

export const certificationSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().max(160),
    issuer: z.string().max(160),
    jurisdiction: z.string().max(100),
    issueDate: dateText,
    expiryDate: dateText,
    noExpiry: z.boolean(),
    credentialStatus: z.enum(["unverified", "active", "expired", "pending"]),
    credentialUrl: z.string().url().or(z.literal("")),
    occupationOrSkill: z.string().max(120),
  })
  .strict();

export const tradeSchema = z
  .object({
    id: z.string().uuid().optional(),
    tradeOrOccupation: z.string().max(160),
    apprenticeshipStatus: z.string().max(80),
    practicalYears: optionalNumber,
    experienceDocumentation: z.enum(["informal", "formally_documented", "both"]),
    employerOrSelfEmployed: z.string().max(160),
    tradeCertification: z.string().max(160),
    licensingStatus: z.enum(["licensed", "in_progress", "not_checked", "not_applicable"]),
    portfolioAvailable: z.boolean().nullable(),
    toolsEquipment: z.string().max(1000),
    drivingLicenceClasses: z.string().max(120),
    willingToCompleteLicensing: z.boolean().nullable(),
    preferredDestination: z.string().max(80),
  })
  .strict();

export const languageSchema = z
  .object({
    id: z.string().uuid().optional(),
    language: z.string().max(80),
    proficiency: z.string().max(40),
    testName: z.string().max(80),
    testStatus: z.enum(["not_taken", "booked", "taken", "official", "practice_estimate"]),
    overallScore: z.number().min(0).max(9).nullable(),
    componentScores: z.record(z.number().min(0).max(9)).default({}),
    testDate: dateText,
    expiryDate: dateText,
    targetScore: z.number().min(0).max(9).nullable(),
    plannedTestDate: dateText,
  })
  .strict();

export const documentSchema = z
  .object({
    type: z.string().min(1).max(80),
    status: z.enum(["available", "unavailable", "expired", "pending", "not_applicable"]),
    filename: z.string().max(240).optional(),
    uploadStatus: z.enum(["idle", "uploading", "uploaded", "failed"]).default("idle"),
  })
  .strict();

export const passportStateSchema = z
  .object({
    preferredName: z.string().max(80),
    citizenshipCountry: z.string().max(80),
    residenceCountry: z.string().max(80),
    currentRegion: z.string().max(120),
    relocationTimeline: z.string().max(80),
    passportAvailable: z.boolean().nullable(),
    passportExpiry: dateText,
    willingToRelocate: z.boolean().nullable(),
    selectedGoals: z.array(z.enum(goalTypes)).min(1).max(goalTypes.length),
    destinations: z.array(z.string().max(3)).max(12),
    openToOtherDestinations: z.boolean(),
    excludedDestinations: z.array(z.string().max(80)).max(12),
    opportunityTypes: z.array(z.string().max(80)).max(12),
    startTimeframe: z.string().max(80),
    fundingRequirement: z.string().max(80),
    salaryExpectation: z.string().max(80),
    willingToLearnLanguage: z.boolean().nullable(),
    workMode: z.string().max(40),
    education: z.array(educationRecordSchema).max(10),
    employment: z.array(employmentRecordSchema).max(10),
    skills: z.array(skillSchema).max(30),
    certifications: z.array(certificationSchema).max(20),
    trade: z.array(tradeSchema).max(10),
    languages: z.array(languageSchema).max(10),
    documents: z.array(documentSchema).max(30),
  })
  .strict();

export type PassportState = z.infer<typeof passportStateSchema>;

export const emptyPassportState: PassportState = {
  preferredName: "",
  citizenshipCountry: "NG",
  residenceCountry: "NG",
  currentRegion: "",
  relocationTimeline: "",
  passportAvailable: null,
  passportExpiry: "",
  willingToRelocate: null,
  selectedGoals: [],
  destinations: [],
  openToOtherDestinations: false,
  excludedDestinations: [],
  opportunityTypes: [],
  startTimeframe: "",
  fundingRequirement: "",
  salaryExpectation: "",
  willingToLearnLanguage: null,
  workMode: "",
  education: [],
  employment: [],
  skills: [],
  certifications: [],
  trade: [],
  languages: [],
  documents: [],
};

export const documentTypes = [
  "passport",
  "academic_transcript",
  "degree_certificate",
  "professional_certificate",
  "trade_certificate",
  "employment_reference",
  "language_result",
  "cv_resume",
  "portfolio",
  "recommendation_letter",
] as const;

export function normalizeSkillName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
