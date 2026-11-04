import { teamMemberListResponseSchema, type TeamMember } from "@/src/contracts/team-response-schema";
import { serverApiGet } from "@/src/lib/api/server-client";

import {
  roleListResponseSchema,
  sessionListResponseSchema,
  teamSettingsResponseSchema,
  type RoleWire,
  type SessionWire,
  type TeamSettingsWire,
} from "./security-response-schema";

/**
 * Server-side team reads for the admin dashboard (BFF). `serverApiGet` forwards the
 * owner's session cookie so the owner-only endpoints authorize the calls.
 *
 * There is no `listHistory` here any more, and no `/admin/team/history` endpoint
 * behind it. Access changes are entries in the one activity log, so the team page
 * reads them through `activityServerApi.listForEntityType("user")` like any other
 * slice of it — the endpoint still only answers the owner for those entries, so
 * nothing about who could see them changed.
 */
export const teamServerApi = {
  list(): Promise<TeamMember[]> {
    return serverApiGet("/admin/team", teamMemberListResponseSchema);
  },

  /** The editable built-in roles and the owner's own, with their permissions and holders. */
  listRoles(): Promise<RoleWire[]> {
    return serverApiGet("/admin/roles", roleListResponseSchema);
  },

  getSettings(): Promise<TeamSettingsWire> {
    return serverApiGet("/admin/team-settings", teamSettingsResponseSchema);
  },

  /** Where one team member is signed in. */
  listMemberSessions(id: string): Promise<SessionWire[]> {
    return serverApiGet(`/admin/team/${encodeURIComponent(id)}/sessions`, sessionListResponseSchema);
  },
};
