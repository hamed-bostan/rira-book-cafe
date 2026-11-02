import { ACTIVITY_ENTITY_TYPES } from "@/src/domain/entities/ActivityEntry";
import { visibleActivityEntityTypes } from "@/src/lib/api/activity-visibility";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionPermissions } from "@/src/lib/require-permission";
import { activityServerApi } from "@/src/presentation/dashboard/activity/activity-server-api";
import { ActivityScreen } from "@/src/presentation/dashboard/activity/ActivityScreen";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";

// The log is read from the REST API (BFF) per request — an audit trail that
// showed a cached past would be worthless.
export const dynamic = "force-dynamic";

type DashboardActivityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardActivityPage({ searchParams }: DashboardActivityPageProps) {
  // Every dashboard role holds `activity.view` today; checking it here keeps the
  // page honest if a role without it is ever added.
  const session = await requirePermission("activity.view");
  const params = await withRememberedPageSize(toSearchParams(await searchParams));

  // The BFF reads forward the viewer's session cookie, so the endpoints decide what
  // this viewer may read.
  //
  // In parallel: the actor options describe the whole log and don't depend on the
  // page being read, so there's nothing for the second call to wait on.
  const [entries, actors, permissions] = await Promise.all([
    activityServerApi.listPage(params),
    activityServerApi.listActors(),
    sessionPermissions(session),
  ]);

  return (
    <ActivityScreen
      entries={entries}
      actors={actors}
      entityTypes={visibleActivityEntityTypes(permissions) ?? ACTIVITY_ENTITY_TYPES}
      isFiltered={params.get("actorId") != null || params.get("entityType") != null || params.get("field") != null}
    />
  );
}
