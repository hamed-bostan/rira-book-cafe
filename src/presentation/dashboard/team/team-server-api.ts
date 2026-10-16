import { teamMemberListResponseSchema, type TeamMember } from "@/src/contracts/team-response-schema";
import { serverApiGet } from "@/src/lib/api/server-client";

/**
 * Server-side team read for the admin dashboard (BFF). `serverApiGet` forwards the
 * admin's session cookie so the admin endpoint authorizes the call.
 *
 * There is no `listHistory` here any more, and no `/admin/team/history` endpoint
 * behind it. Access changes are entries in the one activity log, so the team page
 * reads them through `activityServerApi.listForAction("user.roleChanged")` like
 * any other slice of it — the endpoint still only answers the owner for those
 * entries, so nothing about who could see them changed.
 */
export const teamServerApi = {
  list(): Promise<TeamMember[]> {
    return serverApiGet("/admin/team", teamMemberListResponseSchema);
  },
};
