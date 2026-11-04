import { DEFAULT_ACTIVITY_LIMIT } from "@/src/domain/entities/ActivityEntry";
import { requireOwner } from "@/src/lib/require-admin";
import { activityServerApi } from "@/src/presentation/dashboard/activity/activity-server-api";
import { teamServerApi } from "@/src/presentation/dashboard/team/team-server-api";
import { TEAM_TABS, TeamScreen, type TeamTab } from "@/src/presentation/dashboard/team/TeamScreen";

// Who holds admin access is read from the REST API (BFF) per request — never
// statically cached, so a grant or revoke shows up on the next render.
export const dynamic = "force-dynamic";

type DashboardTeamPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function DashboardTeamPage({ searchParams }: DashboardTeamPageProps) {
  // The layout gates the tree to admins; team management is narrower, so this page
  // re-checks for the owner and redirects an ordinary admin away rather than
  // letting the owner-only endpoint fail at them. The BFF read forwards their
  // session cookie so that endpoint authorizes the call.
  await requireOwner();
  const requested = (await searchParams).tab;
  const tab: TeamTab = TEAM_TABS.find((key) => key === requested) ?? "members";

  // Independent reads, in parallel; each tab reads only what it shows (members and
  // roles name people's roles on every tab). The history is a slice of the one
  // activity log — still owner-only, since `user` entries are (see `activity-visibility`).
  const [members, roles, changes, settings] = await Promise.all([
    teamServerApi.list(),
    teamServerApi.listRoles(),
    tab === "members" ? activityServerApi.listForAction("user.roleChanged", DEFAULT_ACTIVITY_LIMIT) : [],
    tab === "security" ? teamServerApi.getSettings() : null,
  ]);

  return <TeamScreen tab={tab} members={members} roles={roles} changes={changes} settings={settings} />;
}
