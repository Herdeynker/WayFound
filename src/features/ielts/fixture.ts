import type { IeltsOverview } from "./types";

const academicReading = {
  id: "13131313-1313-4313-8313-131313131301",
  slug: "academic-city-shade-diagnostic",
  testType: "academic" as const,
  skill: "reading" as const,
  activityKind: "diagnostic" as const,
  title: "City shade and cooler streets",
  instructions:
    "Read the original passage, then answer every question. The timer continues if you leave and resume.",
  durationSeconds: 720,
  content: {
    passage:
      "On a warm afternoon, two neighbouring streets can feel surprisingly different. A road lined with mature trees often stays cooler because leaves block some solar radiation and release water vapour. Researchers also note that shade is most useful when it reaches pavements and building walls during the hottest hours. Yet tree planting is not a complete solution. Young trees need years of care, roots need adequate soil, and some species struggle during drought. Cities therefore combine planting with pale roof materials, shaded transport stops and drinking-water points. The most effective plans use local temperature measurements and consult residents about the places where heat exposure is greatest.",
    questions: [
      {
        id: "q1",
        prompt: "What process, besides blocking sunlight, helps trees cool streets?",
        options: ["Reflecting noise", "Releasing water vapour", "Heating walls"],
      },
      {
        id: "q2",
        prompt: "Why are young trees not an immediate complete solution?",
        options: ["They require years of care", "They remove water points", "They stop measurement"],
      },
      {
        id: "q3",
        prompt: "Which additional measure is mentioned?",
        options: ["Dark roofs", "Unshaded stops", "Pale roof materials"],
      },
      {
        id: "q4",
        prompt: "What should guide spending?",
        options: ["Local heat evidence", "One district rule", "Building age only"],
      },
    ],
  },
  rubric: { method: "one point per correct answer", unofficial: true },
  provenanceType: "original" as const,
  provenanceTitle: "WAYFOUND original city-shade diagnostic",
  provenanceAuthor: "WAYFOUND editorial team",
  provenanceUrl: null,
  licenceStatus: "approved" as const,
  contentVersion: 1,
};

export const phase13Fixture: IeltsOverview = {
  profile: { testType: "academic", targetBand: 7, testDate: "2026-12-12", recordingRetentionDays: 30 },
  content: [
    academicReading,
    {
      ...academicReading,
      id: "13131313-1313-4313-8313-131313131304",
      slug: "general-community-workshop-diagnostic",
      testType: "general",
      title: "Community repair workshop notice",
      durationSeconds: 600,
      content: {
        passage:
          "Riverside Community Centre will hold a free repair workshop on Saturday from 10:00 to 14:00. Residents may bring one small household electrical item or one piece of clothing for assessment. Volunteer repairers will explain the fault and, where possible, help the owner complete a safe repair. Items must be clean and small enough for one person to carry. The workshop cannot accept microwave ovens, gas appliances or equipment with leaking batteries. Booking is recommended because each hourly session has twelve places. People without an online account can reserve a place by calling the centre before Thursday evening. Replacement parts are not provided, but volunteers can suggest suitable local suppliers. Children may attend with an adult and can join a supervised sewing activity.",
        questions: [
          {
            id: "q1",
            prompt: "How many items may each resident bring?",
            options: ["One", "Two", "Any number"],
          },
          {
            id: "q2",
            prompt: "Which item is not accepted?",
            options: ["A clean shirt", "A leaking battery device", "A small radio"],
          },
          {
            id: "q3",
            prompt: "When should telephone bookings be made?",
            options: ["Before Thursday evening", "After Saturday", "Only at 10:00"],
          },
          {
            id: "q4",
            prompt: "What is available for children?",
            options: [
              "An unsupervised repair bench",
              "A supervised sewing activity",
              "Free replacement parts",
            ],
          },
        ],
      },
      provenanceTitle: "WAYFOUND original community-workshop diagnostic",
    },
    {
      ...academicReading,
      id: "13131313-1313-4313-8313-131313131302",
      slug: "academic-library-trends-writing",
      skill: "writing",
      activityKind: "practice",
      title: "Library visits and digital access",
      instructions: "Write at least 150 words. Summarise the main features and make relevant comparisons.",
      durationSeconds: 1200,
      content: {
        prompt:
          "A city library recorded 42,000 in-person visits and 18,000 digital loans in 2022. By 2024, visits were 45,000 while digital loans reached 41,000. Summarise the main features and comparisons.",
        minimum_words: 150,
      },
      rubric: {
        dimensions: ["task achievement", "coherence", "lexical resource", "grammar"],
        unofficial: true,
      },
      provenanceTitle: "WAYFOUND original library-trends writing task",
    },
    {
      ...academicReading,
      id: "13131313-1313-4313-8313-131313131305",
      slug: "general-training-request-writing",
      testType: "general",
      skill: "writing",
      activityKind: "practice",
      title: "Request a training schedule change",
      instructions:
        "Write at least 150 words. Explain the situation, request a change and suggest a practical alternative.",
      durationSeconds: 1200,
      content: {
        prompt:
          "You enrolled in a weekend professional course, but your work schedule has changed. Write to the course coordinator. Explain the change, request a different session and suggest a suitable alternative.",
        minimum_words: 150,
      },
      rubric: {
        dimensions: ["task achievement", "coherence", "lexical resource", "grammar"],
        unofficial: true,
      },
      provenanceTitle: "WAYFOUND original schedule-change writing task",
    },
    {
      ...academicReading,
      id: "13131313-1313-4313-8313-131313131303",
      slug: "shared-learning-speaking",
      testType: "both",
      skill: "speaking",
      activityKind: "practice",
      title: "Describe a useful learning experience",
      instructions:
        "Prepare for one minute, then record one to two minutes. Your estimate is unofficial and excludes pronunciation scoring.",
      durationSeconds: 120,
      content: {
        prompt:
          "Describe a learning experience that helped you solve a practical problem. Say what you learned, how you used it and why it mattered.",
        preparation_seconds: 60,
        speaking_seconds: 120,
      },
      rubric: {
        dimensions: ["fluency", "coherence", "lexical resource", "grammar"],
        excludes: ["pronunciation"],
        unofficial: true,
      },
      provenanceTitle: "WAYFOUND original useful-learning speaking task",
    },
  ],
  attempts: [
    {
      id: "13131313-1313-4313-8313-131313131311",
      title: "City shade and cooler streets",
      skill: "reading",
      status: "completed",
      scoreRaw: 3,
      scoreMax: 4,
      estimatedBand: 7.5,
      startedAt: "2026-09-11T09:00:00.000Z",
    },
  ],
  feedback: [
    {
      id: "13131313-1313-4313-8313-131313131321",
      skill: "writing",
      estimatedBand: 6.5,
      summary: "The response identifies the main change and can make comparisons more explicit.",
      strengths: ["A clear overview is present."],
      recommendations: ["Compare the two trends directly in each body paragraph."],
      createdAt: "2026-09-11T09:20:00.000Z",
    },
  ],
  studyPlan: {
    headline: "Maintain reading strength and complete writing and speaking practice.",
    nextSteps: ["Complete a writing task.", "Complete a speaking task.", "Review progress weekly."],
    minutesPerDay: 25,
    weakAreas: ["writing", "speaking"],
  },
  resources: [
    {
      id: "13131313-1313-4313-8313-131313131331",
      title: "IELTS preparation resources",
      publisher: "IELTS",
      url: "https://ielts.org/take-a-test/preparation-resources",
      testType: "both",
    },
    {
      id: "13131313-1313-4313-8313-131313131332",
      title: "Official sample test questions",
      publisher: "IELTS",
      url: "https://ielts.org/take-a-test/preparation-resources/sample-test-questions",
      testType: "both",
    },
  ],
  providerConfigured: true,
};
