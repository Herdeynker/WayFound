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

const maximumDocumentBytes = 10 * 1024 * 1024;

export type ValidatedDocument = { extension: string; checksum: string };

export function validateDocumentUpload(
  file: { name: string; type: string; size: number },
  bytes: Uint8Array,
): ValidatedDocument {
  const extension = ".pdf";
  if (
    file.type !== "application/pdf" ||
    file.size <= 0 ||
    file.size > maximumDocumentBytes ||
    bytes.length !== file.size
  )
    throw new Error("Use a PDF under 10 MB.");
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== "%PDF")
    throw new Error("The file signature does not match its declared type.");
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(extension)) throw new Error("The file extension does not match its declared type.");
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
