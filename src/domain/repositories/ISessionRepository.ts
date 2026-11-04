import type { NewActivityEntry } from "../entities/ActivityEntry";
import type { SessionCheck, UserSession } from "../entities/UserSession";

/**
 * Signed-in browsers (see `UserSession`). The JWT names a row here; the row decides
 * whether the token still works.
 */
export type ISessionRepository = {
  /** Record a sign-in. Resolves the new session, whose id goes into the token. */
  start(input: { userId: string; userAgent: string | null; at: Date }): Promise<UserSession>;
  /**
   * Check a session on a request: `null` when it's revoked, expired or gone (the
   * token must stop working), otherwise who it belongs to. Refreshes last-seen when
   * it's gone stale.
   */
  check(id: string, now: Date): Promise<SessionCheck | null>;
  /** The user's sessions that can still be used, most recently seen first. */
  listActive(userId: string, now: Date): Promise<UserSession[]>;
  /**
   * Revoke one of a user's sessions. Resolves false when there was no such active
   * session for that user (so nobody can revoke a session by guessing its id).
   * `entry` is recorded in the same transaction when given.
   */
  revoke(userId: string, sessionId: string, entry?: NewActivityEntry): Promise<boolean>;
  /** Revoke every active session of the user except `exceptId`; resolves how many. */
  revokeAll(userId: string, options?: { exceptId?: string; entry?: NewActivityEntry }): Promise<number>;
  /** Delete revoked rows and rows unseen since `before`, in batches; resolves how many went. */
  pruneInactive(before: Date, batchSize: number): Promise<number>;
};
