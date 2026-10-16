import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { activityServerApi } from "@/src/presentation/dashboard/activity/activity-server-api";
import { ActivityScreen } from "@/src/presentation/dashboard/activity/ActivityScreen";

// The log is read from the REST API (BFF) per request — an audit trail that
// showed a cached past would be worthless.
export const dynamic = "force-dynamic";

type DashboardActivityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardActivityPage({ searchParams }: DashboardActivityPageProps) {
  // Every dashboard role holds `activity.view` today; checking it here keeps the
  // page honest if a role without it is ever added.
  await requirePermission("activity.view");
  const params = toSearchParams(await searchParams);

  // The dashboard layout already gates this tree to admins; the BFF reads forward
  // the admin's session cookie so the admin endpoints authorize the calls.
  //
  // In parallel: the actor options describe the whole log and don't depend on the
  // page being read, so there's nothing for the second call to wait on.
  const [entries, actors] = await Promise.all([
    activityServerApi.listPage(params),
    activityServerApi.listActors(),
  ]);

  return (
    <ActivityScreen
      entries={entries}
      actors={actors}
      isFiltered={
        params.get("actorId") != null ||
        params.get("entityType") != null ||
        params.get("field") != null
      }
    />
  );
}
