import { DEFAULT_LOYALTY_SETTINGS, pointsEarnedFor, pointsValue, redeemablePoints } from "../../entities/Loyalty";
import { normalizePromoCode, promoDiscount, promoProblem, type PromoCode } from "../../entities/Promotion";
import { ConflictError } from "../../errors/ConflictError";

import type { OrderQuote } from "../../entities/Checkout";
import type { Order } from "../../entities/Order";
import type { ILoyaltyRepository } from "../../repositories/ILoyaltyRepository";
import type { IPromotionRepository } from "../../repositories/IPromotionRepository";

export type CheckoutRequest = {
  /** The lines at menu prices, in Toman. */
  subtotal: number;
  /** As the guest typed it; blank = none. Case, spaces, dashes and underscores don't matter. */
  promoCode?: string;
  /** Spend as many points as the order allows. */
  redeemPoints?: boolean;
};

/** The quote plus the code it applied — the order records which code it used. */
export type PricedCheckout = OrderQuote & { promo?: Pick<PromoCode, "id" | "code"> };

/** An order's amounts after staff changed its lines. */
export type RepricedOrder = Pick<
  OrderQuote,
  "subtotal" | "promoDiscount" | "pointsRedeemed" | "pointsDiscount" | "total"
>;

/**
 * How discounts apply to an order, in one place for the basket's preview and the
 * order that's placed: the promo code first (on the menu price), then points on
 * what's left. A code that can't be used is refused with the reason, never
 * silently dropped — the guest typed it expecting money off.
 *
 * Without a promotion or loyalty repository (tests, a cafe that hasn't set them
 * up) the order simply costs its subtotal.
 */
export class CheckoutPricing {
  constructor(
    private readonly promoRepo?: Pick<IPromotionRepository, "getByCode" | "usage">,
    private readonly loyaltyRepo?: Pick<ILoyaltyRepository, "getSettings" | "balance">,
  ) {}

  async execute(request: CheckoutRequest, guestId: string, now: Date): Promise<PricedCheckout> {
    const { subtotal } = request;

    let promo: PromoCode | null = null;
    let promoOff = 0;
    const typed = request.promoCode ? normalizePromoCode(request.promoCode) : "";
    if (typed) {
      const promoRepo = this.promoRepo;
      promo = promoRepo ? await promoRepo.getByCode(typed) : null;
      if (!promo || !promoRepo) throw new ConflictError("PROMO_INVALID", `There's no promo code "${typed}".`);
      const problem = promoProblem(promo, subtotal, await promoRepo.usage(promo.id, guestId), now);
      if (problem) throw new ConflictError(problem, `Promo code "${typed}" can't be used on this order.`);
      promoOff = promoDiscount(promo, subtotal);
    }

    const settings = this.loyaltyRepo
      ? await this.loyaltyRepo.getSettings()
      : { ...DEFAULT_LOYALTY_SETTINGS, enabled: false };
    const balance = this.loyaltyRepo ? await this.loyaltyRepo.balance(guestId) : 0;
    const afterPromo = subtotal - promoOff;
    const available = redeemablePoints(balance, afterPromo, settings);
    if (request.redeemPoints && !settings.enabled)
      throw new ConflictError("LOYALTY_DISABLED", "The loyalty club is off.");
    if (request.redeemPoints && available === 0)
      throw new ConflictError("NOT_ENOUGH_POINTS", "Not enough points to spend on this order.");
    const pointsRedeemed = request.redeemPoints ? available : 0;
    const pointsDiscount = pointsValue(pointsRedeemed, settings);
    const total = afterPromo - pointsDiscount;

    return {
      subtotal,
      promoCode: promo?.code,
      promo: promo ? { id: promo.id, code: promo.code } : undefined,
      promoDiscount: promoOff,
      pointsRedeemed,
      pointsDiscount,
      total,
      pointsBalance: balance,
      pointsAvailable: available,
      pointsToEarn: pointsEarnedFor(total, settings),
      loyaltyEnabled: settings.enabled,
      pointValue: settings.pointValue,
      minRedeemPoints: settings.minRedeemPoints,
    };
  }

  /**
   * Re-price an order whose lines staff changed after it was placed, by the same
   * rules: its promo code is checked as if the order were placed now — its own use
   * of the code aside, which it already holds — and taken off the new subtotal, then
   * the points it already spent come off what's left. It never spends more of the
   * guest's points: nobody asked them.
   *
   * A change these rules can't price is refused rather than guessed at, and the
   * order is cancelled and placed again instead: a code that no longer applies to
   * it (`PROMO_NO_LONGER_APPLIES` — its minimum isn't met any more, it ended, or it's
   * gone), or points spent that are worth more than what's left
   * (`POINTS_EXCEED_TOTAL`).
   */
  async reprice(
    order: Pick<Order, "userId" | "promoCodeId" | "promoCode" | "pointsRedeemed" | "pointsDiscount">,
    subtotal: number,
    now: Date,
  ): Promise<RepricedOrder> {
    let promoOff = 0;
    if (order.promoCodeId) {
      const promoRepo = this.promoRepo;
      const promo = promoRepo && order.promoCode ? await promoRepo.getByCode(order.promoCode) : null;
      if (!promo || !promoRepo || promo.id !== order.promoCodeId) {
        throw new ConflictError("PROMO_NO_LONGER_APPLIES", `Promo code "${order.promoCode ?? ""}" is gone.`);
      }
      // The order is live and carries the code, so it's among the uses counted —
      // but it's the one asking, and it already holds its use.
      const usage = await promoRepo.usage(promo.id, order.userId ?? "");
      const others = { total: Math.max(0, usage.total - 1), byGuest: Math.max(0, usage.byGuest - 1) };
      if (promoProblem(promo, subtotal, others, now)) {
        throw new ConflictError(
          "PROMO_NO_LONGER_APPLIES",
          `Promo code "${promo.code}" can't be used on the order as it would be.`,
        );
      }
      promoOff = promoDiscount(promo, subtotal);
    }

    const total = subtotal - promoOff - order.pointsDiscount;
    if (total < 0) {
      throw new ConflictError(
        "POINTS_EXCEED_TOTAL",
        "The points spent on this order are worth more than it would cost.",
      );
    }
    return {
      subtotal,
      promoDiscount: promoOff,
      pointsRedeemed: order.pointsRedeemed,
      pointsDiscount: order.pointsDiscount,
      total,
    };
  }
}
