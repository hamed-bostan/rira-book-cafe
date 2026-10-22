import type { ConflictCode } from "../errors/ConflictError";

/**
 * A promo code: a word guests type at checkout for money off the order. Either a
 * percentage of the order (optionally capped) or a fixed amount, with optional
 * limits — a minimum order, a date window, how many times it can be used in all
 * and by one guest. Uses are counted from the orders carrying the code; a
 * cancelled order gives its use back.
 */

export const PROMO_KINDS = ["percent", "fixed"] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

/** Letters, digits, `-` and `_`; stored upper-case so guests can type it in any case. */
export const PROMO_CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/;
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
  createdAt: string;
  updatedAt: string;
};

/** A code as the dashboard lists it: with how many live orders carry it. */
export type PromoCodeWithUses = PromoCode & { uses: number };

/** How often a code has been used — in all, and by the guest at checkout. */
export type PromoUsage = { total: number; byGuest: number };

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

/** What the code takes off an order of `subtotal` Toman (never more than the order). */
export function promoDiscount(promo: Pick<PromoCode, "kind" | "value" | "maxDiscount">, subtotal: number): number {
  if (subtotal <= 0) return 0;
  const raw = promo.kind === "percent" ? Math.floor((subtotal * promo.value) / 100) : promo.value;
  const capped = promo.kind === "percent" && promo.maxDiscount !== undefined ? Math.min(raw, promo.maxDiscount) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

/**
 * Why the code can't be used on this order right now, or `null` when it can. The
 * reasons are conflict codes the client localizes.
 */
export function promoProblem(promo: PromoCode, subtotal: number, usage: PromoUsage, now: Date): ConflictCode | null {
  if (!promo.isActive) return "PROMO_INVALID";
  if (promo.startsAt && now < new Date(promo.startsAt)) return "PROMO_EXPIRED";
  if (promo.endsAt && now >= new Date(promo.endsAt)) return "PROMO_EXPIRED";
  if (promo.usageLimit !== undefined && usage.total >= promo.usageLimit) return "PROMO_USED_UP";
  if (promo.perGuestLimit !== undefined && usage.byGuest >= promo.perGuestLimit) return "PROMO_USED_UP";
  if (subtotal < promo.minSubtotal) return "PROMO_MIN_SUBTOTAL";
  return null;
}
