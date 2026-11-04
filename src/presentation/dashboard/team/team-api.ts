import type { CreateRoleInput, UpdateRoleInput } from "@/src/contracts/role-schema";
import { teamMemberResponseSchema, type TeamMember } from "@/src/contracts/team-response-schema";
import type { ChangeRoleInput, GrantAdminInput } from "@/src/contracts/team-schema";
import type { TeamSettingsInput } from "@/src/contracts/team-security-schema";
import { apiDelete, apiPost, apiPut } from "@/src/lib/api/client";

import { roleResponseSchema, teamSettingsResponseSchema } from "./security-response-schema";

/**
 * Typed client for the team REST *mutations*. UI components call these instead of
 * touching Axios directly; each method resolves with the row shape or rejects with
 * an `ApiError` — either normalized from the failure (see `client.ts`) or raised
 * because the response body didn't match its schema. Reads are server-side (see
 * `teamServerApi`); callers `router.refresh()` after.
 */
export const teamApi = {
  grant(values: GrantAdminInput): Promise<TeamMember> {
    return apiPost("/admin/team", values, teamMemberResponseSchema);
  },

  /** Move a member to another role. The endpoint answers with the new role; the refresh after shows it. */
  changeRole(id: string, values: ChangeRoleInput): Promise<void> {
    return apiPut(`/admin/team/${id}`, values);
  },

  revoke(id: string): Promise<void> {
    return apiDelete(`/admin/team/${id}`);
  },

  /**
   * Hand ownership to this member. The caller steps down to admin, so the page
   * they're on becomes read-only to them right after — the refresh that follows
   * is what surfaces that.
   */
  transferOwnership(id: string): Promise<void> {
    return apiPut(`/admin/team/${id}/owner`, undefined);
  },

  /** Sign a member out of every browser. */
  revokeMemberSessions(id: string): Promise<void> {
    return apiDelete(`/admin/team/${encodeURIComponent(id)}/sessions`);
  },

  revokeMemberSession(id: string, sessionId: string): Promise<void> {
    return apiDelete(`/admin/team/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}`);
  },
};

/** The owner's role editor. */
export const rolesApi = {
  create(values: CreateRoleInput): Promise<void> {
    return apiPost("/admin/roles", values, roleResponseSchema).then(() => undefined);
  },

  update(key: string, values: UpdateRoleInput): Promise<void> {
    return apiPut(`/admin/roles/${encodeURIComponent(key)}`, values, roleResponseSchema).then(() => undefined);
  },

  remove(key: string): Promise<void> {
    return apiDelete(`/admin/roles/${encodeURIComponent(key)}`);
  },
};

/** The owner's team-wide security settings. */
export const teamSettingsApi = {
  update(values: TeamSettingsInput): Promise<void> {
    return apiPut("/admin/team-settings", values, teamSettingsResponseSchema).then(() => undefined);
  },
};
