/**
 * The loyalty club: guests earn points on what they spend and spend points as
 * money off a later order. Points live in an append-only ledger per guest — the
 * balance is the sum of its entries — so every point can be traced to the order
 * or the person that moved it.
 *
 * - earned when an order is completed, on what the guest actually paid;
 * - spent at checkout, as a discount;
 * - given back if an order that spent them is cancelled;
 * - adjusted by hand by staff (a goodwill gesture, a correction).
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
};

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: true,
  tomanPerPoint: 10_000,
  pointValue: 1_000,
  minRedeemPoints: 50,
};

export const LOYALTY_REASONS = ["earn", "redeem", "refund", "adjust"] as const;
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

/** The club as a guest sees it: their standing, and the rules that earn and spend points. */
export type GuestLoyaltyOverview = LoyaltyAccount & { settings: LoyaltySettings };

/** A guest's standing as staff look it up at the counter, by phone. */
export type GuestLoyaltyLookup = LoyaltyAccount & { userId: string; name?: string };
