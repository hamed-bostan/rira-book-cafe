/**
 * What an order will cost once its discounts and charges are applied — the
 * basket's preview and, recomputed on the server, the order that's placed. Every
 * amount is whole Toman, and
 * `total = subtotal − promoDiscount − pointsDiscount + serviceCharge`.
 */
export type OrderQuote = {
  /** The lines at menu prices. */
  subtotal: number;
  /** The promo code applied (normalized), if any. */
  promoCode?: string;
  promoDiscount: number;
  /** Points spent on this order, and what they take off. */
  pointsRedeemed: number;
  pointsDiscount: number;
  /** The service charge on what's left after the discounts (0 for a takeaway, or when it's off). */
  serviceCharge: number;
  /** The service charge rate, in basis points — 0 when the cafe charges none. */
  serviceChargeBps: number;
  /** What the guest pays. */
  total: number;
  /** The guest's balance before this order. */
  pointsBalance: number;
  /** The most points they could spend on this order (0 below the minimum or when the club is off). */
  pointsAvailable: number;
  /** What completing this order would earn. */
  pointsToEarn: number;
  loyaltyEnabled: boolean;
  /** Toman one point is worth. */
  pointValue: number;
  minRedeemPoints: number;
};
