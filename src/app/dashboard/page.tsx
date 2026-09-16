import { DashboardShell } from "@/components/dashboard-shell";
import { dashboardFixture } from "@/features/dashboard/dashboard-fixtures";
import { requireDashboardUser, isTestFixtureRequest } from "@/server/auth/guards";
import { getDashboardModel } from "@/server/dashboard/query";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await isTestFixtureRequest()) {
    const params = (await searchParams) ?? {};
    const tour = params.tour === "1";
    const checklistCollapsed = params.checklist === "collapsed";
    if (!tour && !checklistCollapsed) return <DashboardShell />;
    return (
      <DashboardShell
        model={{
          ...dashboardFixture,
          checklist: { ...dashboardFixture.checklist, collapsed: checklistCollapsed },
          walkthrough: { ...dashboardFixture.walkthrough, completed: !tour },
        }}
      />
    );
  }
  const { client, user } = await requireDashboardUser();
  if (!user) return null;
  return <DashboardShell model={await getDashboardModel(client, user)} />;
}
