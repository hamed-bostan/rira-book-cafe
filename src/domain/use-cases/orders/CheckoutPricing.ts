import { DEFAULT_LOYALTY_SETTINGS, pointsEarnedFor, pointsValue, redeemablePoints } from "../../entities/Loyalty";
import { MAX_ORDER_AMOUNT, serviceChargeFor, type Order, type OrderItem, type ServiceType } from "../../entities/Order";
import {
  archivedPromoProblem,
  eligibleSubtotal,
  isPromoScoped,
  normalizePromoCode,
  promoDiscount,
  promoProblem,
  type PromoCode,
  type PromoLine,
  type PromoUsage,
} from "../../entities/Promotion";
import { ConflictError } from "../../errors/ConflictError";
import { ValidationError } from "../../errors/ValidationError";

import type { OrderQuote } from "../../entities/Checkout";
import type { ILedgerRepository } from "../../repositories/ILedgerRepository";
import type { ILoyaltyRepository } from "../../repositories/ILoyaltyRepository";
import type { IProductRepository } from "../../repositories/IProductRepository";
import type { IPromotionRepository } from "../../repositories/IPromotionRepository";

/** One priced line as discounts read it: which item, and what it comes to (Toman). */
export type CheckoutLine = { productId: string; amount: number };

/** The lines of an order (or a basket being priced) as {@link CheckoutLine}s. */
export function checkoutLines(
  items: readonly Pick<OrderItem, "productId" | "unitPrice" | "quantity">[],
): CheckoutLine[] {
  return items.map((item) => ({ productId: item.productId, amount: item.unitPrice * item.quantity }));
}

export type CheckoutRequest = {
  /** The lines at menu prices, in Toman. */
  subtotal: number;
  /**
   * The lines behind the subtotal, for a promo code scoped to items or categories.
   * Left out, the order reads as one line nothing is scoped to — fine for an
   * unscoped code, while a scoped one finds nothing it covers.
   */
  lines?: readonly CheckoutLine[];
  /** As the guest typed it; blank = none. Case, spaces, dashes and underscores don't matter. */
  promoCode?: string;
  /** Spend as many points as the order allows. */
  redeemPoints?: boolean;
  /** How it's served: a dine-in order carries the service charge. Left out = none. */
  serviceType?: ServiceType;
};

/** The quote plus the code it applied — the order records which code it used. */
export type PricedCheckout = OrderQuote & { promo?: Pick<PromoCode, "id" | "code"> };

/** An order's amounts after staff changed its lines or its service. */
export type RepricedOrder = Pick<
  OrderQuote,
  "subtotal" | "promoDiscount" | "pointsRedeemed" | "pointsDiscount" | "serviceCharge" | "total"
>;

type PromoSource = Pick<IPromotionRepository, "getByCode" | "getById" | "usage"> &
  Partial<Pick<IPromotionRepository, "hasCompletedOrder">>;

/**
 * How discounts and charges apply to an order, in one place for the basket's
 * preview, the order that's placed — online or at the counter — and an order staff
 * change: the promo code first (on the menu price of the lines it covers), then
 * points on what's left, then the service charge on what's left after both (see
 * `serviceChargeFor`). A code that can't be used is refused with the reason, never
 * silently dropped — the guest typed it expecting money off.
 *
 * Without a promotion or loyalty repository (tests, a cafe that hasn't set them
 * up) the order simply costs its subtotal; without the accounting settings it
 * carries no service charge; without the catalog a code scoped to categories finds
 * no line in them.
 */
export class CheckoutPricing {
  constructor(
    private readonly promoRepo?: PromoSource,
    private readonly loyaltyRepo?: Pick<ILoyaltyRepository, "getSettings" | "balance">,
    /** Where the service charge rate is kept (with the VAT rate). */
    private readonly chargesRepo?: Pick<ILedgerRepository, "getSettings">,
    /** The menu, for which category each line's item is in. */
    private readonly catalog?: Pick<IProductRepository, "getByIds">,
  ) {}

  /**
   * Price an order for `guestId` — the guest's profile (a new guest's id is the
   * normalized phone the profile will be made under), or `null` for an order on no
   * profile, which can neither spend points nor take a code with a per-guest rule.
   */
  async execute(request: CheckoutRequest, guestId: string | null, now: Date): Promise<PricedCheckout> {
    const { subtotal } = request;

    let promo: PromoCode | null = null;
    let promoOff = 0;
    const typed = request.promoCode ? normalizePromoCode(request.promoCode) : "";
    if (typed) {
      const promoRepo = this.promoRepo;
      promo = promoRepo ? await promoRepo.getByCode(typed) : null;
      if (!promo || !promoRepo) throw new ConflictError("PROMO_INVALID", `There's no promo code "${typed}".`);
      const eligible = await this.eligible(promo, subtotal, request.lines);
      const usage = guestId ? await promoRepo.usage(promo.id, guestId) : await anonymousUsage(promoRepo, promo.id);
      const hasCompletedOrder =
        promo.firstOrderOnly && guestId && promoRepo.hasCompletedOrder
          ? await promoRepo.hasCompletedOrder(guestId)
          : false;
      const problem = promoProblem(promo, eligible, usage, now, { known: guestId !== null, hasCompletedOrder });
      if (problem) throw new ConflictError(problem, `Promo code "${typed}" can't be used on this order.`);
      promoOff = promoDiscount(promo, eligible);
    }

    const settings = this.loyaltyRepo
      ? await this.loyaltyRepo.getSettings()
      : { ...DEFAULT_LOYALTY_SETTINGS, enabled: false };
    const balance = this.loyaltyRepo && guestId ? await this.loyaltyRepo.balance(guestId) : 0;
    const afterPromo = subtotal - promoOff;
    const available = redeemablePoints(balance, afterPromo, settings);
    if (request.redeemPoints && !settings.enabled)
      throw new ConflictError("LOYALTY_DISABLED", "The loyalty club is off.");
    if (request.redeemPoints && available === 0)
      throw new ConflictError("NOT_ENOUGH_POINTS", "Not enough points to spend on this order.");
    const pointsRedeemed = request.redeemPoints ? available : 0;
    const pointsDiscount = pointsValue(pointsRedeemed, settings);

    const serviceChargeBps = await this.serviceChargeRate();
    const charges = withServiceCharge(afterPromo - pointsDiscount, serviceChargeBps, request.serviceType);

    return {
      subtotal,
      promoCode: promo?.code,
      promo: promo ? { id: promo.id, code: promo.code } : undefined,
      promoDiscount: promoOff,
      pointsRedeemed,
      pointsDiscount,
      serviceCharge: charges.serviceCharge,
      serviceChargeBps,
      total: charges.total,
      pointsBalance: balance,
      pointsAvailable: available,
      // Points are earned on what the guest paid for the goods, not on the service charge.
      pointsToEarn: pointsEarnedFor(charges.total - charges.serviceCharge, settings),
      loyaltyEnabled: settings.enabled,
      pointValue: settings.pointValue,
      minRedeemPoints: settings.minRedeemPoints,
    };
  }

  /**
   * Re-price an order whose lines or service staff changed after it was placed, by
   * the same rules: its promo code is checked as if the order were placed now — its
   * own use of the code aside, which it already holds, and whether it's the guest's
   * first order, which was settled when the code was taken — and taken off what the
   * code covers of the new lines, then the points it already spent come off what's
   * left. It never spends more of the guest's points: nobody asked them. The service
   * charge follows the service (`serviceType`) at the rate the order was placed with.
   *
   * A change these rules can't price is refused rather than guessed at, and the
   * order is cancelled and placed again instead: a code that no longer applies to
   * it (`PROMO_NO_LONGER_APPLIES` — its minimum isn't met any more, nothing it covers
   * is left, it ended, or it's gone), or points spent that are worth more than what's
   * left (`POINTS_EXCEED_TOTAL`).
   *
   * The code is read back by the id the order carries, so it's found even after
   * staff renamed it or deleted it. A code deleted after orders used it is archived,
   * not removed, and an archived code keeps its deal on the orders that hold it:
   * deleting a code stops guests using it again, it doesn't take back a discount an
   * order already got. Only the deal's own terms still apply (`archivedPromoProblem`
   * — something it covers, and its minimum order); whether it could be *taken* now
   * (switched on, in its dates, uses left) is a question for new orders, and it can't
   * be taken by any.
   */
  async reprice(
    order: Pick<
      Order,
      "userId" | "promoCodeId" | "promoCode" | "pointsRedeemed" | "pointsDiscount" | "serviceType" | "serviceChargeBps"
    >,
    subtotal: number,
    now: Date,
    lines?: readonly CheckoutLine[],
    serviceType: ServiceType = order.serviceType,
  ): Promise<RepricedOrder> {
    let promoOff = 0;
    if (order.promoCodeId) {
      const promoRepo = this.promoRepo;
      const promo = promoRepo ? await promoRepo.getById(order.promoCodeId) : null;
      if (!promo || !promoRepo) {
        throw new ConflictError("PROMO_NO_LONGER_APPLIES", `Promo code "${order.promoCode ?? ""}" is gone.`);
      }
      // The order is live and carries the code, so it's among the uses counted —
      // but it's the one asking, and it already holds its use.
      const others = async (): Promise<PromoUsage> => {
        const usage = await promoRepo.usage(promo.id, order.userId ?? "");
        return { total: Math.max(0, usage.total - 1), byGuest: Math.max(0, usage.byGuest - 1) };
      };
      const eligible = await this.eligible(promo, subtotal, lines);
      const problem = promo.archivedAt
        ? archivedPromoProblem(promo, eligible)
        : promoProblem(promo, eligible, await others(), now, {
            known: order.userId !== undefined,
            hasCompletedOrder: false,
          });
      if (problem) {
        throw new ConflictError(
          "PROMO_NO_LONGER_APPLIES",
          `Promo code "${promo.code}" can't be used on the order as it would be.`,
        );
      }
      promoOff = promoDiscount(promo, eligible);
    }

    const afterDiscounts = subtotal - promoOff - order.pointsDiscount;
    if (afterDiscounts < 0) {
      throw new ConflictError(
        "POINTS_EXCEED_TOTAL",
        "The points spent on this order are worth more than it would cost.",
      );
    }
    const charges = withServiceCharge(afterDiscounts, order.serviceChargeBps, serviceType);
    return {
      subtotal,
      promoDiscount: promoOff,
      pointsRedeemed: order.pointsRedeemed,
      pointsDiscount: order.pointsDiscount,
      serviceCharge: charges.serviceCharge,
      total: charges.total,
    };
  }

  /** The service charge rate in force now, in basis points (0 without the settings). */
  async serviceChargeRate(): Promise<number> {
    return this.chargesRepo ? (await this.chargesRepo.getSettings()).serviceChargeBps : 0;
  }

  /** What of the order the code applies to: the lines it covers, or all of it when it isn't scoped. */
  private async eligible(promo: PromoCode, subtotal: number, lines?: readonly CheckoutLine[]): Promise<number> {
    if (!isPromoScoped(promo)) return subtotal;
    if (!lines) return 0;
    let categoryOf = new Map<string, string>();
    if (promo.categoryIds.length > 0 && this.catalog) {
      const products = await this.catalog.getByIds([...new Set(lines.map((line) => line.productId))]);
      categoryOf = new Map(products.map((product) => [product.id, product.categoryId]));
    }
    const promoLines: PromoLine[] = lines.map((line) => ({ ...line, categoryId: categoryOf.get(line.productId) }));
    return eligibleSubtotal(promo, promoLines);
  }
}

/** A code's uses with no guest to count against: only the total matters. */
async function anonymousUsage(promoRepo: PromoSource, promoId: string): Promise<PromoUsage> {
  const usage = await promoRepo.usage(promoId, "");
  return { total: usage.total, byGuest: 0 };
}

/**
 * The service charge on `afterDiscounts` and the total with it. Refused when the
 * charge takes the order past what one order can hold (its amounts are 32-bit).
 */
function withServiceCharge(
  afterDiscounts: number,
  rateBps: number,
  serviceType: ServiceType | undefined,
): { serviceCharge: number; total: number } {
  const serviceCharge = serviceType ? serviceChargeFor(afterDiscounts, rateBps, serviceType) : 0;
  const total = afterDiscounts + serviceCharge;
  if (total > MAX_ORDER_AMOUNT) {
    throw new ValidationError("items", "That's more than one order can hold — split it into two.");
  }
  return { serviceCharge, total };
}
