import type { ApplicationItem, DocumentLibraryItem } from "./application-tracker";

export const phase9Documents: DocumentLibraryItem[] = [
  {
    id: "demo-document",
    name: "Passport scan.pdf",
    type: "Passport",
    category: "identity",
    expiresOn: "2030-06-01",
    updatedAt: "2026-09-09T10:00:00.000Z",
  },
];
export const phase9Applications: ApplicationItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Global Technology Scholarship",
    organization: "Northbridge University",
    status: "preparing",
    officialDeadline: "2026-11-20",
    internalDeadline: "2026-10-30",
    checklistDone: 1,
    checklistTotal: 3,
  },
];
