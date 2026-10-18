import { DEFAULT_LOYALTY_SETTINGS, pointsEarnedFor, pointsValue, redeemablePoints } from "../../entities/Loyalty";
import { normalizePromoCode, promoDiscount, promoProblem, type PromoCode } from "../../entities/Promotion";
import { ConflictError } from "../../errors/ConflictError";

import type { OrderQuote } from "../../entities/Checkout";
import type { ILoyaltyRepository } from "../../repositories/ILoyaltyRepository";
import type { IPromotionRepository } from "../../repositories/IPromotionRepository";

export type CheckoutRequest = {
  /** The lines at menu prices, in Toman. */
  subtotal: number;
  /** As the guest typed it; blank = none. */
  promoCode?: string;
  /** Spend as many points as the order allows. */
  redeemPoints?: boolean;
};

/** The quote plus the code it applied — the order records which code it used. */
export type PricedCheckout = OrderQuote & { promo?: Pick<PromoCode, "id" | "code"> };

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
}
