import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import type { Database } from "@/server/supabase/database.types";
import { ProviderDisabledError } from "@/server/providers";
import { parseServerEnvironment } from "@/lib/env/schema";
import {
  analyseCv,
  buildGroundedGenerationEnvelope,
  contentFingerprint,
  deterministicDraft,
  groundedDraftOutputSchema,
  validateSourceFactProvenance,
  validateGroundedDraft,
  type SourceFact,
} from "./model";
import type { DraftKind, DraftTone } from "@/features/assistant/types";
import type { AssistantSourceFact } from "@/features/assistant/types";
import { createConfiguredAIProvider } from "./provider";

type Result = { data: unknown; error: { code?: string; message?: string } | null };
type Query = PromiseLike<Result> & {
  select(columns?: string): Query;
  insert(values: unknown): Query;
  update(values: unknown): Query;
  delete(): Query;
  eq(column: string, value: unknown): Query;
  in(column: string, values: readonly unknown[]): Query;
  order(column: string, options?: { ascending?: boolean }): Query;
  limit(value: number): Query;
  single(): Promise<Result>;
  maybeSingle(): Promise<Result>;
};
type DynamicClient = { from(table: string): Query };
type UserClient = SupabaseClient<Database>;

const dynamic = (client: unknown) => client as DynamicClient;
const row = (data: unknown) =>
  typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
const rows = (data: unknown) =>
  Array.isArray(data) ? data.flatMap((item) => (row(item) ? [row(item)!] : [])) : [];
const text = (value: unknown) => (typeof value === "string" ? value : "");

async function ownedApplication(admin: DynamicClient, userId: string, applicationId: string) {
  const applicationResult = await admin
    .from("applications")
    .select("id,user_id,opportunity_id")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  const application = row(applicationResult.data);
  if (applicationResult.error || !application) throw new Error("OWNED_APPLICATION_REQUIRED");
  const opportunityResult = await admin
    .from("opportunities")
    .select("id,title,summary,application_url,organization_id,destination_country_id")
    .eq("id", application.opportunity_id)
    .maybeSingle();
  const opportunity = row(opportunityResult.data);
  if (opportunityResult.error || !opportunity) throw new Error("OPPORTUNITY_UNAVAILABLE");
  let organization = "Selected opportunity";
  if (typeof opportunity.organization_id === "string") {
    const organizationResult = await admin
      .from("organizations")
      .select("name")
      .eq("id", opportunity.organization_id)
      .maybeSingle();
    organization = text(row(organizationResult.data)?.name) || organization;
  }
  return {
    application,
    opportunity,
    opportunityCopy: {
      title: text(opportunity.title) || "Selected opportunity",
      organization,
      summary: text(opportunity.summary),
    },
  };
}

async function confirmedProfileFacts(admin: DynamicClient, userId: string) {
  const requests = [
    ["profiles", "display_name,first_name"],
    ["education_records", "institution,qualification,field_of_study"],
    ["employment_records", "employer,title"],
    ["user_skills", "skill_name"],
    ["certifications", "name,issuer"],
  ] as const;
  const values: string[] = [];
  for (const [table, columns] of requests) {
    const result = await admin
      .from(table)
      .select(columns)
      .eq(table === "profiles" ? "id" : "user_id", userId)
      .limit(40);
    for (const item of rows(result.data))
      for (const value of Object.values(item))
        if (typeof value === "string" && value.trim().length >= 2) values.push(value.trim());
  }
  return [...new Set(values)].slice(0, 80);
}

function stableFactId(value: string, index: number) {
  const hash = contentFingerprint({ index, value });
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function getAssistantContext(userId: string) {
  const admin = dynamic(createSupabaseAdminClient());
  const applicationResult = await admin
    .from("applications")
    .select("id,opportunity_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);
  const applicationRows = rows(applicationResult.data);
  const applications: Array<{ id: string; title: string }> = [];
  for (const application of applicationRows) {
    const applicationId = text(application.id);
    const opportunityId = text(application.opportunity_id);
    if (!applicationId || !opportunityId) continue;
    const opportunityResult = await admin
      .from("opportunities")
      .select("title")
      .eq("id", opportunityId)
      .maybeSingle();
    const opportunity = row(opportunityResult.data);
    const title = text(opportunity?.title) || "Selected application workspace";
    applications.push({ id: applicationId, title });
  }

  const profileFacts = await confirmedProfileFacts(admin, userId);
  const candidates: Omit<AssistantSourceFact, "id">[] = [];
  if (applications[0]) {
    candidates.push({
      category: "opportunity",
      label: "Selected opportunity",
      value: applications[0].title,
      evidenceLabel: "Selected application workspace",
      approved: true,
    });
  }
  for (const [index, value] of profileFacts.slice(0, 12).entries()) {
    candidates.push({
      category: "passport",
      label: `Confirmed profile fact ${index + 1}`,
      value,
      evidenceLabel: "Confirmed Opportunity Passport",
      approved: true,
    });
  }
  return {
    applications,
    sourceFacts: candidates.map((fact, index) => ({
      ...fact,
      id: stableFactId(`${fact.category}:${fact.label}:${fact.value}`, index),
    })),
  };
}

export async function runCvAnalysis(input: { userId: string; applicationId: string; cvText: string }) {
  const admin = dynamic(createSupabaseAdminClient());
  const { opportunity, opportunityCopy } = await ownedApplication(admin, input.userId, input.applicationId);
  const facts = await confirmedProfileFacts(admin, input.userId);
  const fingerprint = contentFingerprint({
    userId: input.userId,
    applicationId: input.applicationId,
    cvHash: contentFingerprint(input.cvText),
    opportunityId: opportunity.id,
    facts,
    schema: "phase10.cv.v1",
  });
  const existingResult = await admin
    .from("cv_analyses")
    .select("id,alignment_score")
    .eq("user_id", input.userId)
    .eq("input_fingerprint", fingerprint)
    .maybeSingle();
  const existing = row(existingResult.data);
  if (existing) {
    const findingResult = await admin
      .from("cv_analysis_findings")
      .select("finding_kind,section_name,summary")
      .eq("analysis_id", existing.id)
      .order("sort_order", { ascending: true });
    return {
      analysisId: text(existing.id),
      alignmentScore: Number(existing.alignment_score ?? 0),
      findings: rows(findingResult.data).map((finding) => ({
        kind: text(finding.finding_kind),
        section: text(finding.section_name),
        summary: text(finding.summary),
      })),
    };
  }
  const analysed = analyseCv({
    text: input.cvText,
    opportunityText: `${opportunityCopy.title} ${opportunityCopy.summary}`,
    confirmedFacts: facts,
  });
  const analysisResult = await admin
    .from("cv_analyses")
    .insert({
      user_id: input.userId,
      application_id: input.applicationId,
      status: "completed",
      alignment_score: analysed.alignmentScore,
      input_fingerprint: fingerprint,
      schema_version: "phase10.cv.v1",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  const analysis = row(analysisResult.data);
  if (analysisResult.error || !analysis) throw new Error("ANALYSIS_PERSISTENCE_FAILED");
  const analysisId = text(analysis.id);
  if (analysed.findings.length) {
    const findingResult = await admin.from("cv_analysis_findings").insert(
      analysed.findings.map((finding, index) => ({
        analysis_id: analysisId,
        user_id: input.userId,
        finding_kind: finding.kind,
        section_name: finding.section,
        summary: finding.summary,
        sort_order: index,
      })),
    );
    if (findingResult.error) throw new Error("ANALYSIS_PERSISTENCE_FAILED");
  }
  const auditResult = await admin.from("audit_events").insert({
    user_id: input.userId,
    event_type: "cv_analysis_completed",
    metadata: { analysis_id: analysisId, application_id: input.applicationId },
  });
  if (auditResult.error) throw new Error("ANALYSIS_AUDIT_FAILED");
  return { analysisId, alignmentScore: analysed.alignmentScore, findings: analysed.findings };
}

async function reserveGeneration(userClient: UserClient, draftId: string, requestKey: string) {
  const rpc = userClient as unknown as {
    rpc(
      name: string,
      args: Record<string, string>,
    ): Promise<{ data: string | null; error: { message?: string } | null }>;
  };
  const result = await rpc.rpc("phase10_reserve_generation", {
    candidate_draft_id: draftId,
    request_key: requestKey,
  });
  if (result.error || !result.data) {
    const quota = result.error?.message?.includes("quota");
    const retry = result.error?.message?.includes("retry limit");
    throw new Error(
      quota ? "QUOTA_REACHED" : retry ? "RETRY_LIMIT_REACHED" : "GENERATION_RESERVATION_FAILED",
    );
  }
  return result.data;
}

async function finalizeGeneration(input: {
  admin: DynamicClient;
  userId: string;
  draftId: string;
  generationRequestId: string;
  revisionId: string;
  providerName: string;
  modelVersion: string;
  kind: string;
  status?: "draft" | "approved";
}) {
  const draftUpdate = await input.admin
    .from("assistant_drafts")
    .update({ status: input.status ?? "draft", current_revision_id: input.revisionId })
    .eq("id", input.draftId)
    .eq("user_id", input.userId);
  if (draftUpdate.error) throw new Error("DRAFT_PERSISTENCE_FAILED");
  const requestUpdate = await input.admin
    .from("assistant_generation_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", input.generationRequestId)
    .eq("user_id", input.userId);
  if (requestUpdate.error) throw new Error("GENERATION_PERSISTENCE_FAILED");
  const existingUsage = await input.admin
    .from("assistant_usage_ledger")
    .select("id")
    .eq("generation_request_id", input.generationRequestId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existingUsage.error) throw new Error("USAGE_PERSISTENCE_FAILED");
  if (!existingUsage.data) {
    const usageResult = await input.admin.from("assistant_usage_ledger").insert({
      user_id: input.userId,
      generation_request_id: input.generationRequestId,
      units: 1,
      estimated_cost_microunits: 0,
      provider_name: input.providerName,
      model_version: input.modelVersion,
    });
    if (usageResult.error) throw new Error("USAGE_PERSISTENCE_FAILED");
    const auditResult = await input.admin.from("audit_events").insert({
      user_id: input.userId,
      event_type: "assistant_draft_generated",
      metadata: { draft_id: input.draftId, revision_id: input.revisionId, kind: input.kind },
    });
    if (auditResult.error) throw new Error("GENERATION_AUDIT_FAILED");
  }
}

export async function generateApplicationDraft(input: {
  userId: string;
  userClient: UserClient;
  applicationId: string;
  idempotencyKey: string;
  kind: string;
  title: string;
  tone: string;
  wordLimit: number;
  facts: readonly SourceFact[];
}) {
  const admin = dynamic(createSupabaseAdminClient());
  const { opportunity, opportunityCopy } = await ownedApplication(admin, input.userId, input.applicationId);
  const profileFacts = await confirmedProfileFacts(admin, input.userId);
  validateSourceFactProvenance(input.facts, profileFacts, opportunityCopy);
  const existingResult = await admin
    .from("assistant_drafts")
    .select("id,status,current_revision_id,fact_set_id")
    .eq("user_id", input.userId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  let draft = row(existingResult.data);
  if (draft?.current_revision_id && ["draft", "approved"].includes(text(draft.status))) {
    const revisionResult = await admin
      .from("assistant_draft_revisions")
      .select("id,content,word_count,generation_request_id,provider_name,model_version")
      .eq("id", draft.current_revision_id)
      .eq("user_id", input.userId)
      .maybeSingle();
    const revision = row(revisionResult.data);
    if (revision) {
      await finalizeGeneration({
        admin,
        userId: input.userId,
        draftId: text(draft.id),
        generationRequestId: text(revision.generation_request_id),
        revisionId: text(revision.id),
        providerName: text(revision.provider_name),
        modelVersion: text(revision.model_version),
        kind: input.kind,
        status: text(draft.status) === "approved" ? "approved" : "draft",
      });
      return {
        draftId: text(draft.id),
        revisionId: text(revision.id),
        content: text(revision.content),
        wordCount: Number(revision.word_count),
        replayed: true,
      };
    }
  }
  if (!draft) {
    const factSetResult = await admin
      .from("assistant_fact_sets")
      .insert({
        user_id: input.userId,
        application_id: input.applicationId,
        opportunity_id: opportunity.id,
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const factSet = row(factSetResult.data);
    if (factSetResult.error || !factSet) throw new Error("FACT_PERSISTENCE_FAILED");
    const factSetId = text(factSet.id);
    const factsResult = await admin.from("assistant_source_facts").insert(
      input.facts.map((fact) => ({
        id: fact.id,
        fact_set_id: factSetId,
        user_id: input.userId,
        category: fact.category,
        label: fact.label,
        fact_value: fact.value,
        evidence_label: fact.evidenceLabel,
        evidence_url: fact.evidenceUrl ?? null,
        approved_at: new Date().toISOString(),
      })),
    );
    if (factsResult.error) throw new Error("FACT_PERSISTENCE_FAILED");
    const draftResult = await admin
      .from("assistant_drafts")
      .insert({
        user_id: input.userId,
        application_id: input.applicationId,
        opportunity_id: opportunity.id,
        fact_set_id: factSetId,
        kind: input.kind,
        title: input.title,
        tone: input.tone,
        word_limit: input.wordLimit,
        status: "collecting",
        idempotency_key: input.idempotencyKey,
      })
      .select("id,status,current_revision_id,fact_set_id")
      .single();
    draft = row(draftResult.data);
    if (draftResult.error || !draft) throw new Error("DRAFT_PERSISTENCE_FAILED");
  }
  const draftId = text(draft.id);
  const generationRequestId = await reserveGeneration(input.userClient, draftId, input.idempotencyKey);
  const recoveredRevisionResult = await admin
    .from("assistant_draft_revisions")
    .select("id,content,word_count,provider_name,model_version")
    .eq("generation_request_id", generationRequestId)
    .eq("user_id", input.userId)
    .maybeSingle();
  const recoveredRevision = row(recoveredRevisionResult.data);
  if (recoveredRevisionResult.error) throw new Error("DRAFT_PERSISTENCE_FAILED");
  if (recoveredRevision) {
    await finalizeGeneration({
      admin,
      userId: input.userId,
      draftId,
      generationRequestId,
      revisionId: text(recoveredRevision.id),
      providerName: text(recoveredRevision.provider_name),
      modelVersion: text(recoveredRevision.model_version),
      kind: input.kind,
    });
    return {
      draftId,
      revisionId: text(recoveredRevision.id),
      content: text(recoveredRevision.content),
      wordCount: Number(recoveredRevision.word_count),
      replayed: true,
    };
  }
  const validatedInput = {
    applicationId: input.applicationId,
    idempotencyKey: input.idempotencyKey,
    kind: input.kind as DraftKind,
    title: input.title,
    tone: input.tone as DraftTone,
    wordLimit: input.wordLimit,
    facts: [...input.facts],
  };
  const envelope = buildGroundedGenerationEnvelope(validatedInput, opportunityCopy);
  const env = parseServerEnvironment();
  const deterministic = process.env.PLAYWRIGHT_TEST === "1" || process.env.NODE_ENV === "test";
  const providerName = deterministic ? "deterministic-test" : env.AI_PROVIDER || "disabled";
  const modelVersion = deterministic ? "phase10-fixture-v1" : env.AI_MODEL || "unconfigured";
  try {
    const output = deterministic
      ? deterministicDraft(validatedInput)
      : await createConfiguredAIProvider().generateStructured({
          operation: "grounded_application_draft",
          input: envelope,
          outputSchema: groundedDraftOutputSchema,
        });
    const checked = validateGroundedDraft(output, input.facts, input.wordLimit);
    const priorResult = await admin
      .from("assistant_draft_revisions")
      .select("revision_number")
      .eq("draft_id", draftId)
      .order("revision_number", { ascending: false })
      .limit(1);
    const revisionNumber = Number(rows(priorResult.data)[0]?.revision_number ?? 0) + 1;
    const revisionResult = await admin
      .from("assistant_draft_revisions")
      .insert({
        draft_id: draftId,
        generation_request_id: generationRequestId,
        user_id: input.userId,
        revision_number: revisionNumber,
        content: checked.content,
        word_count: checked.wordCount,
        grounding_status: checked.groundingStatus,
        validation_result: {
          fact_count: input.facts.length,
          paragraph_count: checked.parsed.sections.flatMap((section) => section.paragraphs).length,
        },
        provider_name: providerName,
        model_version: modelVersion,
        schema_version: checked.parsed.schemaVersion,
        input_fingerprint: contentFingerprint(envelope),
      })
      .select("id")
      .single();
    const revision = row(revisionResult.data);
    if (revisionResult.error || !revision) throw new Error("DRAFT_PERSISTENCE_FAILED");
    const revisionId = text(revision.id);
    await finalizeGeneration({
      admin,
      userId: input.userId,
      draftId,
      generationRequestId,
      revisionId,
      providerName,
      modelVersion,
      kind: input.kind,
    });
    return { draftId, revisionId, content: checked.content, wordCount: checked.wordCount, replayed: false };
  } catch (error) {
    const code =
      error instanceof ProviderDisabledError
        ? "PROVIDER_DISABLED"
        : error instanceof Error && error.message.includes("timed out")
          ? "PROVIDER_TIMEOUT"
          : error instanceof Error && error.message.includes("approved")
            ? "GROUNDING_REJECTED"
            : "PROVIDER_REJECTED";
    const failedRequest = await admin
      .from("assistant_generation_requests")
      .update({ status: "failed", safe_error_code: code })
      .eq("id", generationRequestId);
    const failedDraft = await admin
      .from("assistant_drafts")
      .update({ status: "failed" })
      .eq("id", draftId)
      .eq("user_id", input.userId);
    if (failedRequest.error || failedDraft.error) throw new Error("FAILURE_PERSISTENCE_FAILED");
    throw new Error(code);
  }
}

export async function approveDraft(userClient: UserClient, draftId: string, revisionId: string) {
  const rpc = userClient as unknown as {
    rpc(name: string, args: Record<string, string>): Promise<{ data: boolean | null; error: unknown }>;
  };
  const result = await rpc.rpc("phase10_approve_revision", {
    candidate_draft_id: draftId,
    candidate_revision_id: revisionId,
  });
  if (result.error || !result.data) throw new Error("OWNED_REVISION_REQUIRED");
}

export async function getExportRevision(userId: string, draftId: string) {
  const admin = dynamic(createSupabaseAdminClient());
  const draftResult = await admin
    .from("assistant_drafts")
    .select("id,title,approved_revision_id")
    .eq("id", draftId)
    .eq("user_id", userId)
    .maybeSingle();
  const draft = row(draftResult.data);
  if (!draft?.approved_revision_id) throw new Error("APPROVED_REVISION_REQUIRED");
  const revisionResult = await admin
    .from("assistant_draft_revisions")
    .select("id,content")
    .eq("id", draft.approved_revision_id)
    .eq("draft_id", draftId)
    .eq("user_id", userId)
    .maybeSingle();
  const revision = row(revisionResult.data);
  if (!revision) throw new Error("APPROVED_REVISION_REQUIRED");
  return { title: text(draft.title), revisionId: text(revision.id), content: text(revision.content), admin };
}

export async function recordExport(input: {
  admin: DynamicClient;
  userId: string;
  draftId: string;
  revisionId: string;
  format: string;
  checksum: string;
}) {
  const exportResult = await input.admin.from("assistant_exports").insert({
    draft_id: input.draftId,
    revision_id: input.revisionId,
    user_id: input.userId,
    export_format: input.format,
    checksum_sha256: input.checksum,
  });
  if (exportResult.error) throw new Error("EXPORT_PERSISTENCE_FAILED");
  const auditResult = await input.admin.from("audit_events").insert({
    user_id: input.userId,
    event_type: "assistant_draft_exported",
    metadata: { draft_id: input.draftId, revision_id: input.revisionId, format: input.format },
  });
  if (auditResult.error) throw new Error("EXPORT_AUDIT_FAILED");
}

export async function getAssistantSummary(client: unknown, userId: string) {
  const source = dynamic(client);
  const [draftResult, analysisResult] = await Promise.all([
    source
      .from("assistant_drafts")
      .select("id,title,kind,status,updated_at,current_revision_id,approved_revision_id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20),
    source
      .from("cv_analyses")
      .select("id,alignment_score,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  return {
    drafts: rows(draftResult.data).map((item) => ({
      id: text(item.id),
      title: text(item.title),
      kind: text(item.kind),
      status: text(item.status),
      updatedAt: text(item.updated_at),
      revisionId: text(item.current_revision_id),
      approvedRevisionId: text(item.approved_revision_id),
    })),
    analyses: rows(analysisResult.data).map((item) => ({
      id: text(item.id),
      alignmentScore: Number(item.alignment_score ?? 0),
      createdAt: text(item.created_at),
    })),
  };
}
