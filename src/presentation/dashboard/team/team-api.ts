import { teamMemberResponseSchema, type TeamMember } from "@/src/contracts/team-response-schema";
import type { GrantAdminInput } from "@/src/contracts/team-schema";
import { apiDelete, apiPost, apiPut } from "@/src/lib/api/client";

/**
 * Typed client for the team REST *mutations*. UI components call these instead of
 * touching Axios directly; each method resolves with the row shape or rejects with
 * an `ApiError` — either normalized from the failure (see `client.ts`) or raised
 * because the response body didn't match `teamMemberResponseSchema`.
 * Reads are server-side (see `teamServerApi`).
 */
export const teamApi = {
  grant(values: GrantAdminInput): Promise<TeamMember> {
    return apiPost("/admin/team", values, teamMemberResponseSchema);
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
};
