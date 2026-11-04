import { apiDelete } from "@/src/lib/api/client";

/**
 * Typed client for your own sign-in security: signing your browsers out. Callers
 * `router.refresh()` (or navigate) after, so the server stays the source of truth.
 */
export const securityApi = {
  revokeSession(sessionId: string): Promise<void> {
    return apiDelete(`/admin/me/sessions/${encodeURIComponent(sessionId)}`);
  },

  /** Every browser but this one. */
  revokeOtherSessions(): Promise<void> {
    return apiDelete("/admin/me/sessions");
  },
};
