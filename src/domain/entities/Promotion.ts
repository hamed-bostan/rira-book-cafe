import type { ConflictCode } from "../errors/ConflictError";

/**
 * A promo code: a word guests type at checkout for money off the order. Either a
 * percentage of the order (optionally capped) or a fixed amount, with optional
 * limits — a minimum order, a date window, how many times it can be used in all
 * and by one guest. Uses are counted from the orders carrying the code; a
 * cancelled order gives its use back.
 *
 * A code can be scoped: to some menu items and/or categories (it then takes money
 * off only those lines — "10% off books"), and/or to a guest's first order. See
 * {@link eligibleSubtotal} for how a scoped code reads the basket.
 */

export const PROMO_KINDS = ["percent", "fixed"] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

/**
 * Letters and numbers only, stored upper-case so guests can type it in any case.
 * Codes saved before this rule may still carry `-` or `_`; checkout finds them
 * either way (see {@link promoCodeKey}).
 */
export const PROMO_CODE_PATTERN = /^[A-Z0-9]{3,16}$/;
export const MAX_PROMO_CODE_LENGTH = 16;
export const MAX_PROMO_DESCRIPTION_LENGTH = 120;

export type PromoCode = {
  id: string;
  code: string;
  /** Staff's note on what it's for, e.g. "Book club members". */
  description?: string;
  kind: PromoKind;
  /** Whole percent (1–100) for `percent`; Toman off for `fixed`. */
  value: number;
  /** For `percent`: the most it takes off, in Toman. */
  maxDiscount?: number;
  /** The order (before discounts) must reach this, in Toman; 0 = no minimum. */
  minSubtotal: number;
  /** ISO 8601 (UTC). Absent = from now on / no end. */
  startsAt?: string;
  endsAt?: string;
  /** Most uses in all / by one guest. Absent = unlimited. */
  usageLimit?: number;
  perGuestLimit?: number;
  isActive: boolean;
  /**
   * The menu items and categories the code takes money off. Both empty = the whole
   * order. When either is set, only lines whose item is listed, or whose item is in
   * a listed category, count — for the discount *and* for the minimum order.
   */
  productIds: string[];
  categoryIds: string[];
  /**
   * Only for a guest's first order: one placed while their profile has no completed
   * order yet. Checked when the code is taken — an order that took it keeps it.
   */
  firstOrderOnly: boolean;
  /**
   * ISO 8601, set when staff deleted a code that orders had used. An archived code
   * is kept rather than removed — the orders carrying it still resolve it by id, and
   * its code stays taken so it can't come back with fresh per-guest limits — but it
   * is gone for staff and guests alike: off the list, never usable at checkout, never
   * switched on or edited again. Absent for every code still in use.
   */
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

/** A code as the dashboard lists it: with how many live orders carry it. */
export type PromoCodeWithUses = PromoCode & { uses: number };

/** How often a code has been used — in all, and by the guest at checkout. */
export type PromoUsage = { total: number; byGuest: number };

/** The most items, or categories, one code can be scoped to. */
export const MAX_PROMO_SCOPE_ENTRIES = 100;

/** One line of a basket as a code reads it: which item, in which category, for how much (Toman). */
export type PromoLine = { productId: string; categoryId?: string; amount: number };

/** Whether the code is limited to some items or categories. */
export function isPromoScoped(promo: Pick<PromoCode, "productIds" | "categoryIds">): boolean {
  return promo.productIds.length > 0 || promo.categoryIds.length > 0;
}

/**
 * What of the basket the code applies to: every line for a code that isn't scoped;
 * otherwise the lines whose item is listed or whose item's category is (either
 * matches — "these two cakes, and anything in Books").
 *
 * Decision: a scoped code's minimum order counts these lines only, as its discount
 * does ("spend 500,000 on books, get 10% off books") — the way the major commerce
 * platforms read a minimum on an item-specific discount. An unscoped code's minimum
 * is the whole order, as before.
 */
export function eligibleSubtotal(
  promo: Pick<PromoCode, "productIds" | "categoryIds">,
  lines: readonly PromoLine[],
): number {
  if (!isPromoScoped(promo)) return lines.reduce((sum, line) => sum + line.amount, 0);
  const products = new Set(promo.productIds);
  const categories = new Set(promo.categoryIds);
  return lines.reduce(
    (sum, line) =>
      products.has(line.productId) || (line.categoryId !== undefined && categories.has(line.categoryId))
        ? sum + line.amount
        : sum,
    0,
  );
}

/**
 * Who a code is being taken for, as far as its guest-bound rules care: whether the
 * order is on a guest's profile at all (a per-guest limit or a first-order rule
 * needs one to count against), and whether that guest already has a completed order.
 */
export type PromoGuest = { known: boolean; hasCompletedOrder: boolean };

/** A guest with a profile and no completed order: what a check assumes unless told. */
const NEW_GUEST: PromoGuest = { known: true, hasCompletedOrder: false };

/**
 * Where a code stands for the dashboard list:
 * - `live` — on, started, not ended, uses left: guests can use it now;
 * - `scheduled` — on, but its first day hasn't come;
 * - `off` — switched off by staff;
 * - `ended` — its last day has passed (whether or not it's switched on);
 * - `usedUp` — every use it allowed has been taken.
 * The last two can't come back by flipping the switch — only by editing the code.
 */
export const PROMO_CODE_STATES = ["live", "scheduled", "off", "ended", "usedUp"] as const;
export type PromoCodeState = (typeof PROMO_CODE_STATES)[number];

export function promoCodeState(promo: PromoCodeWithUses, now: Date): PromoCodeState {
  if (promo.endsAt && now >= new Date(promo.endsAt)) return "ended";
  if (promo.usageLimit !== undefined && promo.uses >= promo.usageLimit) return "usedUp";
  if (!promo.isActive) return "off";
  if (promo.startsAt && now < new Date(promo.startsAt)) return "scheduled";
  return "live";
}

/** True once a code can only come back by editing it — the switch alone won't do. */
export function isPromoCodeFinished(state: PromoCodeState): boolean {
  return state === "ended" || state === "usedUp";
}

/** A typed code as stored: trimmed and upper-cased. */
export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

/** What a guest may type between a code's letters and numbers without changing which code it is. */
const PROMO_CODE_SEPARATORS = /[\s_-]/g;

/**
 * A code reduced to what identifies it at checkout: its letters and numbers,
 * upper-cased. "autumn-15", "Autumn 15" and "AUTUMN15" all key to `AUTUMN15` —
 * and so does a code saved as "AUTUMN-15" before codes were letters and numbers
 * only, so it keeps working.
 */
export function promoCodeKey(code: string): string {
  return code.toUpperCase().replace(PROMO_CODE_SEPARATORS, "");
}

/** What the code takes off an order of `subtotal` Toman (never more than the order). */
export function promoDiscount(promo: Pick<PromoCode, "kind" | "value" | "maxDiscount">, subtotal: number): number {
  if (subtotal <= 0) return 0;
  const raw = promo.kind === "percent" ? Math.floor((subtotal * promo.value) / 100) : promo.value;
  const capped = promo.kind === "percent" && promo.maxDiscount !== undefined ? Math.min(raw, promo.maxDiscount) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

/**
 * Why the code can't be used on this order right now, or `null` when it can. The
 * reasons are conflict codes the client localizes. `eligible` is what the code
 * applies to ({@link eligibleSubtotal}): the whole order for an unscoped code.
 *
 * A code with a per-guest limit, or for first orders, needs the order to be on a
 * guest's profile (`PROMO_NEEDS_GUEST`) — there'd be nobody to count it against.
 */
export function promoProblem(
  promo: PromoCode,
  eligible: number,
  usage: PromoUsage,
  now: Date,
  guest: PromoGuest = NEW_GUEST,
): ConflictCode | null {
  if (promo.archivedAt || !promo.isActive) return "PROMO_INVALID";
  if (promo.startsAt && now < new Date(promo.startsAt)) return "PROMO_EXPIRED";
  if (promo.endsAt && now >= new Date(promo.endsAt)) return "PROMO_EXPIRED";
  if ((promo.perGuestLimit !== undefined || promo.firstOrderOnly) && !guest.known) return "PROMO_NEEDS_GUEST";
  if (promo.usageLimit !== undefined && usage.total >= promo.usageLimit) return "PROMO_USED_UP";
  if (promo.perGuestLimit !== undefined && usage.byGuest >= promo.perGuestLimit) return "PROMO_USED_UP";
  if (promo.firstOrderOnly && guest.hasCompletedOrder) return "PROMO_FIRST_ORDER";
  return termsProblem(promo, eligible);
}

/** The deal's own terms on this basket: something it covers, and enough of it. */
function termsProblem(
  promo: Pick<PromoCode, "minSubtotal" | "productIds" | "categoryIds">,
  eligible: number,
): ConflictCode | null {
  if (isPromoScoped(promo) && eligible <= 0) return "PROMO_NOT_ELIGIBLE";
  if (eligible < promo.minSubtotal) return "PROMO_MIN_SUBTOTAL";
  return null;
}

/**
 * Why an archived code can't stay on an order staff changed, or `null` when it
 * can. Only the deal's own terms — something on the order it covers, and its
 * minimum order on those lines — still apply: the checks on
 * *taking* a code (switched on, within its dates, uses left) are for new orders,
 * which can never take an archived code, while an order that already holds one
 * keeps the deal it was placed with (see `CheckoutPricing.reprice`).
 */
export function archivedPromoProblem(
  promo: Pick<PromoCode, "minSubtotal" | "productIds" | "categoryIds">,
  eligible: number,
): ConflictCode | null {
  return termsProblem(promo, eligible);
}
