import type { AuditHook } from "./AuditHook";
import type { LapsingPoints, LoyaltySettings, LoyaltyTransaction } from "../entities/Loyalty";

/** A manual adjustment, attributed to the staff member who made it. */
export type PointsAdjustment = {
  userId: string;
  delta: number;
  note: string;
  by: { id: string; name: string };
};

/** A guest's lapsed balance being taken off, as the expiry job read it. */
export type PointsExpiry = LapsingPoints & {
  /** Recorded on the ledger entry, e.g. "No activity for 12 months". */
  note: string;
};

export type ILoyaltyRepository = {
  getSettings(): Promise<LoyaltySettings>;
  /** Save the club's rules, with the activity entry `audit` returns in the same transaction. */
  saveSettings(settings: LoyaltySettings, audit?: AuditHook<LoyaltySettings>): Promise<LoyaltySettings>;
  balance(userId: string): Promise<number>;
  /** A guest's movements, newest first. */
  history(userId: string, limit: number): Promise<LoyaltyTransaction[]>;
  /**
   * Add or take away points by hand. Taking more than the guest has is refused
   * (`ConflictError("NOT_ENOUGH_POINTS")`) — checked under the guest's lock, with a
   * database trigger as the backstop. The activity entry commits with it.
   */
  adjust(adjustment: PointsAdjustment, audit?: AuditHook<LoyaltyTransaction>): Promise<LoyaltyTransaction>;
  /** ISO 8601 of the guest's last movement that keeps points alive (`isLoyaltyActivity`), if any. */
  lastActivity(userId: string): Promise<string | undefined>;
  /**
   * Guests holding points whose last activity was before `activeBefore`, oldest
   * first, at most `limit` — the expiry job's candidates.
   */
  listLapsing(activeBefore: Date, limit: number): Promise<LapsingPoints[]>;
  /**
   * Take a guest's whole balance off as expired, under the guest's points lock, and
   * only if nothing moved since the job read it: their last activity is still
   * `lastActivityAt` and they still hold points. Once per period of inactivity. The
   * activity entry commits with it. Resolves to the points taken (0 when skipped).
   */
  expire(expiry: PointsExpiry, audit?: AuditHook<LoyaltyTransaction>): Promise<number>;
};
