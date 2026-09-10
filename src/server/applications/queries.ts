import "server-only";

import type {
  ApplicationItem,
  ApplicationWorkspaceItem,
  DocumentLibraryItem,
} from "@/features/applications/application-tracker";

type QueryResult = { data: unknown; error: unknown };
type Query = {
  select(columns: string): Query;
  eq(column: string, value: string): Query;
  order(column: string, options?: { ascending?: boolean }): Promise<QueryResult>;
};
type DynamicClient = { from(table: string): Query };

const asRows = (data: unknown) => (Array.isArray(data) ? data : []);
const stringValue = (value: unknown) => (typeof value === "string" ? value : null);

export async function getDocumentLibrary(client: unknown, userId: string): Promise<DocumentLibraryItem[]> {
  const result = await (client as DynamicClient)
    .from("document_metadata")
    .select("id,original_filename,document_type,category,expires_on,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (result.error) return [];
  return asRows(result.data).flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const data = row as Record<string, unknown>;
    const id = stringValue(data.id);
    const updatedAt = stringValue(data.updated_at);
    const type = stringValue(data.document_type);
    if (!id || !updatedAt || !type) return [];
    return [
      {
        id,
        name: stringValue(data.original_filename) ?? "Private document",
        type,
        category: stringValue(data.category) ?? "other",
        expiresOn: stringValue(data.expires_on),
        updatedAt,
      },
    ];
  });
}

export async function getApplications(client: unknown, userId: string): Promise<ApplicationItem[]> {
  const result = await (client as DynamicClient)
    .from("applications")
    .select("id,status,official_deadline,internal_deadline,opportunity_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (result.error) return [];
  const applications = asRows(result.data).flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const data = row as Record<string, unknown>;
    const id = stringValue(data.id);
    const status = stringValue(data.status);
    if (!id || !status) return [];
    return [
      {
        id,
        title: "Your application workspace",
        organization: "Opportunity details are available in your saved match.",
        status: status as ApplicationItem["status"],
        officialDeadline: stringValue(data.official_deadline),
        internalDeadline: stringValue(data.internal_deadline),
        checklistDone: 0,
        checklistTotal: 0,
      },
    ];
  });
  return Promise.all(
    applications.map(async (application) => {
      const checklist = await (client as DynamicClient)
        .from("application_checklist_items")
        .select("completed_at")
        .eq("application_id", application.id)
        .order("created_at", { ascending: true });
      const rows = checklist.error ? [] : asRows(checklist.data);
      return {
        ...application,
        checklistTotal: rows.length,
        checklistDone: rows.filter(
          (row) =>
            typeof row === "object" &&
            row !== null &&
            stringValue((row as Record<string, unknown>).completed_at),
        ).length,
      };
    }),
  );
}

export async function getApplicationWorkspace(
  client: unknown,
  userId: string,
  applicationId: string,
): Promise<ApplicationWorkspaceItem | null> {
  const tracker = await getApplications(client, userId);
  const application = tracker.find((item) => item.id === applicationId);
  if (!application) return null;
  const dynamic = client as DynamicClient;
  const [checklistResult, notesResult, remindersResult, historyResult] = await Promise.all([
    dynamic
      .from("application_checklist_items")
      .select("id,title,requirement_state,completed_at")
      .eq("application_id", applicationId)
      .order("sort_order", { ascending: true }),
    dynamic
      .from("application_notes")
      .select("id,body,created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    dynamic
      .from("application_reminders")
      .select("id,message,reminder_at,status")
      .eq("application_id", applicationId)
      .order("reminder_at", { ascending: true }),
    dynamic
      .from("application_status_events")
      .select("id,from_status,to_status,note,created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
  ]);
  const records = (result: QueryResult) => (result.error ? [] : asRows(result.data));
  return {
    application,
    checklist: records(checklistResult).flatMap((row) => {
      if (typeof row !== "object" || row === null) return [];
      const data = row as Record<string, unknown>;
      const id = stringValue(data.id);
      const title = stringValue(data.title);
      return id && title
        ? [
            {
              id,
              title,
              state: stringValue(data.requirement_state) ?? "required",
              completed: Boolean(stringValue(data.completed_at)),
            },
          ]
        : [];
    }),
    notes: records(notesResult).flatMap((row) => {
      if (typeof row !== "object" || row === null) return [];
      const data = row as Record<string, unknown>;
      const id = stringValue(data.id);
      const body = stringValue(data.body);
      const createdAt = stringValue(data.created_at);
      return id && body && createdAt ? [{ id, body, createdAt }] : [];
    }),
    reminders: records(remindersResult).flatMap((row) => {
      if (typeof row !== "object" || row === null) return [];
      const data = row as Record<string, unknown>;
      const id = stringValue(data.id);
      const message = stringValue(data.message);
      const reminderAt = stringValue(data.reminder_at);
      return id && message && reminderAt
        ? [{ id, message, reminderAt, status: stringValue(data.status) ?? "pending" }]
        : [];
    }),
    history: records(historyResult).flatMap((row) => {
      if (typeof row !== "object" || row === null) return [];
      const data = row as Record<string, unknown>;
      const id = stringValue(data.id);
      const to = stringValue(data.to_status);
      const createdAt = stringValue(data.created_at);
      return id && to && createdAt
        ? [{ id, from: stringValue(data.from_status), to, note: stringValue(data.note) ?? "", createdAt }]
        : [];
    }),
  };
}
