/**
 * What an order will cost once its discounts are applied — the basket's preview
 * and, recomputed on the server, the order that's placed. Every amount is whole
 * Toman, and `total = subtotal − promoDiscount − pointsDiscount`.
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
