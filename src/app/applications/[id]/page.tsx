import { notFound } from "next/navigation";
import { ApplicationWorkspace } from "@/features/applications/application-tracker";
import { isTestFixtureRequest, requireConsentedUser } from "@/server/auth/guards";
import { getApplicationWorkspace } from "@/server/applications/queries";
import { phase9Applications } from "@/features/applications/fixture";

export default async function ApplicationWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { id } = await params;
  if (await isTestFixtureRequest()) {
    const { state } = await searchParams;
    const completed = state === "completed";
    return (
      <ApplicationWorkspace
        initial={{
          application: {
            ...phase9Applications[0],
            checklistDone: completed ? 3 : 1,
            id,
            status: completed ? "accepted" : phase9Applications[0].status,
          },
          checklist: [
            {
              id: "fixture-check-1",
              title: "Official transcript",
              state: "required",
              completed,
            },
            {
              id: "fixture-check-2",
              title: "Statement of purpose",
              state: "required",
              completed,
            },
            {
              id: "fixture-check-3",
              title: "Academic reference",
              state: "conditional",
              completed,
            },
          ],
          notes: [],
          reminders: [],
          history: completed
            ? [
                {
                  id: "fixture-history",
                  from: "offer",
                  to: "accepted",
                  note: "Outcome recorded by the user.",
                  createdAt: "2026-09-09T10:00:00.000Z",
                },
              ]
            : [],
        }}
      />
    );
  }
  const { client, user } = await requireConsentedUser();
  if (!user) return null;
  const workspace = await getApplicationWorkspace(client, user.id, id);
  if (!workspace) notFound();
  return <ApplicationWorkspace initial={workspace} />;
}
