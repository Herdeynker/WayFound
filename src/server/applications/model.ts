import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

export const applicationStatuses = [
  "interested",
  "preparing",
  "ready",
  "submitted",
  "assessment",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

export const documentCategories = [
  "identity",
  "education",
  "employment",
  "language",
  "professional",
  "trade",
  "portfolio",
  "application",
  "other",
] as const;

export const documentUploadSchema = z
  .object({
    documentType: z.string().trim().min(1).max(80),
    category: z.enum(documentCategories).default("other"),
    expiresOn: z.string().date().optional(),
  })
  .strict();

export const createWorkspaceSchema = z
  .object({ matchId: z.string().uuid(), idempotencyKey: z.string().uuid() })
  .strict();
export const statusTransitionSchema = z
  .object({
    status: z.enum(applicationStatuses),
    note: z.string().trim().max(1000).default(""),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const applicationNoteSchema = z.object({ body: z.string().trim().min(1).max(8000) }).strict();
export const applicationReminderSchema = z
  .object({ reminderAt: z.string().datetime({ offset: true }), message: z.string().trim().min(1).max(240) })
  .strict();
export const checklistUpdateSchema = z.object({ completed: z.boolean() }).strict();

const allowedFiles = new Map([
  ["application/pdf", ".pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
]);
const maximumDocumentBytes = 10 * 1024 * 1024;

export type ValidatedDocument = { extension: string; checksum: string };

function signatureMatches(bytes: Uint8Array, mime: string) {
  if (mime === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 4)) === "%PDF";
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  return bytes.slice(0, 4).join(",") === "80,75,3,4";
}

export function validateDocumentUpload(
  file: { name: string; type: string; size: number },
  bytes: Uint8Array,
): ValidatedDocument {
  const extension = allowedFiles.get(file.type);
  if (!extension || file.size <= 0 || file.size > maximumDocumentBytes || bytes.length !== file.size)
    throw new Error("Use a PDF, DOCX, JPG or PNG under 10 MB.");
  if (!signatureMatches(bytes, file.type))
    throw new Error("The file signature does not match its declared type.");
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(extension) && !(extension === ".jpg" && lowerName.endsWith(".jpeg")))
    throw new Error("The file extension does not match its declared type.");
  return { extension, checksum: createHash("sha256").update(bytes).digest("hex") };
}

export function applicationTransitionAllowed(from: ApplicationStatus, to: ApplicationStatus) {
  if (from === to) return true;
  return new Map<ApplicationStatus, readonly ApplicationStatus[]>([
    ["interested", ["preparing", "withdrawn"]],
    ["preparing", ["ready", "submitted", "withdrawn"]],
    ["ready", ["preparing", "submitted", "withdrawn"]],
    ["submitted", ["assessment", "rejected", "withdrawn"]],
    ["assessment", ["interview", "offer", "rejected", "withdrawn"]],
    ["interview", ["offer", "rejected", "withdrawn"]],
    ["offer", ["accepted", "rejected", "withdrawn"]],
    ["accepted", []],
    ["rejected", []],
    ["withdrawn", []],
  ])
    .get(from)!
    .includes(to);
}
