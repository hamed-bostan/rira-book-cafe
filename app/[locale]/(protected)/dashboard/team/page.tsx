import { DEFAULT_ACTIVITY_LIMIT } from "@/src/domain/entities/ActivityEntry";
import { requireOwner } from "@/src/lib/require-admin";
import { activityServerApi } from "@/src/presentation/dashboard/activity/activity-server-api";
import { teamServerApi } from "@/src/presentation/dashboard/team/team-server-api";
import { TeamScreen } from "@/src/presentation/dashboard/team/TeamScreen";

// Who holds admin access is read from the REST API (BFF) per request — never
// statically cached, so a grant or revoke shows up on the next render.
export const dynamic = "force-dynamic";

export default async function DashboardTeamPage() {
  // The layout gates the tree to admins; team management is narrower, so this page
  // re-checks for the owner and redirects an ordinary admin away rather than
  // letting the owner-only endpoint fail at them. The BFF read forwards their
  // session cookie so that endpoint authorizes the call.
  await requireOwner();
  // Two independent reads, so they go in parallel rather than in series. The
  // history is now a slice of the one activity log rather than its own endpoint —
  // still owner-only, since `user` entries are (see `activity-visibility`).
  const [members, changes] = await Promise.all([
    teamServerApi.list(),
    activityServerApi.listForAction("user.roleChanged", DEFAULT_ACTIVITY_LIMIT),
  ]);

  return <TeamScreen members={members} changes={changes} />;
}
