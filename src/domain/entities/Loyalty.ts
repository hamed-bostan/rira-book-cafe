/**
 * The loyalty club: guests earn points on what they spend and spend points as
 * money off a later order. Points live in an append-only ledger per guest — the
 * balance is the sum of its entries — so every point can be traced to the order
 * or the person that moved it.
 *
 * - earned when an order is completed, on what the guest actually paid;
 * - spent at checkout, as a discount;
 * - given back if an order that spent them is cancelled;
 * - adjusted by hand by staff (a goodwill gesture, a correction);
 * - expired, when the owner has set an expiry and the guest went that long without
 *   earning or spending (see {@link pointsExpireAt}).
 */

export type LoyaltySettings = {
  /** Off: no points are earned or spent. Balances are kept. */
  enabled: boolean;
  /** Spend this many Toman to earn one point. */
  tomanPerPoint: number;
  /** One point takes this many Toman off an order. */
  pointValue: number;
  /** The fewest points a guest can spend at once. */
  minRedeemPoints: number;
  /**
   * A guest's whole balance lapses after this many months without activity; 0 =
   * points never expire (the default).
   */
  pointsExpiryMonths: number;
  /**
   * ISO 8601, when expiry was last switched on (set by the use-case, never by the
   * form): months of inactivity before it don't count, so turning expiry on never
   * takes anyone's points the same day. Absent while expiry is off.
   */
  pointsExpirySince?: string;
};

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: true,
  tomanPerPoint: 10_000,
  pointValue: 1_000,
  minRedeemPoints: 50,
  pointsExpiryMonths: 0,
};

/** The longest expiry the owner can set: ten years. */
export const MAX_POINTS_EXPIRY_MONTHS = 120;
/** How long before their points lapse a guest is told, in days. */
export const POINTS_EXPIRY_WARNING_DAYS = 14;

export const LOYALTY_REASONS = ["earn", "redeem", "refund", "adjust", "expire"] as const;
export type LoyaltyReason = (typeof LOYALTY_REASONS)[number];

export const MAX_LOYALTY_NOTE_LENGTH = 200;
/** The largest single manual adjustment, either way. */
export const MAX_POINTS_ADJUSTMENT = 100_000;

export type LoyaltyTransaction = {
  id: string;
  userId: string;
  /** Points in (positive) or out (negative). */
  delta: number;
  reason: LoyaltyReason;
  orderId?: string;
  orderNumber?: number;
  note?: string;
  createdByName?: string;
  createdAt: string;
};

/** A guest's standing in the club. */
export type LoyaltyAccount = {
  balance: number;
  /** Recent movements, newest first. */
  history: LoyaltyTransaction[];
};

/** Points a completed order earns: a whole point per `tomanPerPoint` paid. */
export function pointsEarnedFor(total: number, settings: LoyaltySettings): number {
  if (!settings.enabled || total <= 0) return 0;
  return Math.floor(total / settings.tomanPerPoint);
}

/**
 * The most points the guest can spend on an order still costing `payable`: all of
 * their balance, but no more than the order is worth, and none at all below the
 * minimum. Whole points only, so the discount is always a whole number of points.
 */
export function redeemablePoints(balance: number, payable: number, settings: LoyaltySettings): number {
  if (!settings.enabled || balance < settings.minRedeemPoints || payable <= 0) return 0;
  const points = Math.min(balance, Math.floor(payable / settings.pointValue));
  return points >= settings.minRedeemPoints ? points : 0;
}

export function pointsValue(points: number, settings: Pick<LoyaltySettings, "pointValue">): number {
  return points * settings.pointValue;
}

/**
 * Whether a movement keeps a guest's points alive: earning, spending, points given
 * back by a cancelled order, or points staff gave. Points taken away (a correction,
 * a clawback) and an expiry itself don't count — they aren't the guest using the club.
 */
export function isLoyaltyActivity(transaction: Pick<LoyaltyTransaction, "reason" | "delta">): boolean {
  return transaction.reason === "redeem" || (transaction.reason !== "expire" && transaction.delta > 0);
}

/** `date` plus whole calendar months (UTC), the day clamped to the month's last one (Jan 31 + 1 = Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/**
 * When a guest's points lapse, or `null` when they don't: the club is off, expiry
 * is off, or the guest has never been active.
 *
 * Decision: the whole balance lapses after `pointsExpiryMonths` of *inactivity* —
 * the guest neither earned nor spent ({@link isLoyaltyActivity}) — rather than each
 * earn expiring on its own. It's the rule the big programmes use (airline and hotel
 * clubs), it's one date a guest can understand ("use them by 3 Esfand"), and any
 * visit keeps every point alive. Inactivity is counted from the later of the last
 * activity and the day expiry was switched on.
 */
export function pointsExpireAt(lastActivityAt: string | undefined, settings: LoyaltySettings): Date | null {
  if (!settings.enabled || settings.pointsExpiryMonths <= 0 || !lastActivityAt) return null;
  const since = settings.pointsExpirySince ? new Date(settings.pointsExpirySince) : null;
  const last = new Date(lastActivityAt);
  return addMonths(since && since > last ? since : last, settings.pointsExpiryMonths);
}

/** The club as a guest sees it: their standing, and the rules that earn and spend points. */
export type GuestLoyaltyOverview = LoyaltyAccount & {
  settings: LoyaltySettings;
  /** ISO 8601, when the balance lapses unless the guest earns or spends first; absent when it won't. */
  expiresAt?: string;
};

/** A guest whose points may lapse: their balance and their last activity (ISO 8601). */
export type LapsingPoints = { userId: string; balance: number; lastActivityAt: string };

/** A guest's standing as staff look it up at the counter, by phone. */
export type GuestLoyaltyLookup = LoyaltyAccount & { userId: string; name?: string };
