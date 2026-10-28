/**
 * Stock presentation rules — one source of truth for how on-hand quantity maps to
 * the storefront's states, shared by every read-side surface (cards, detail panel,
 * the dashboard list) so "out of stock" and "only N left" never diverge between
 * them. Framework-free, so it's importable from anywhere in the app.
 */

import { MAX_LINE_QUANTITY } from "./Order";

/** At or below this many units on hand (but above 0), the storefront nudges with "only N left". */
export const LOW_STOCK_THRESHOLD = 5;

/** What the stock rules read off an item: its count, and whether it's counted at all. */
export type StockedItem = { stockQuantity: number; madeToOrder: boolean };

export type StockStatus =
  /** Nothing on hand — add-to-cart is blocked and checkout can't oversell. */
  | { level: "out" }
  /** Running low (1…LOW_STOCK_THRESHOLD) — sellable, but surfaced with an "only N left" nudge. */
  | { level: "low"; quantity: number }
  /** Comfortable stock — no special messaging. */
  | { level: "in"; quantity: number }
  /** Made when ordered — not counted, so never out or low by count. */
  | { level: "madeToOrder" };

/**
 * Classify an item into a stock state. A made-to-order item is its own state
 * whatever its count says; for a counted one, negative/NaN is treated as out of
 * stock (safe).
 */
export function getStockStatus(item: StockedItem): StockStatus {
  if (item.madeToOrder) return { level: "madeToOrder" };
  const { stockQuantity } = item;
  if (!(stockQuantity > 0)) return { level: "out" };
  if (stockQuantity <= LOW_STOCK_THRESHOLD) return { level: "low", quantity: stockQuantity };
  return { level: "in", quantity: stockQuantity };
}

/** Whether ordering the item is blocked: a counted item with nothing on hand. */
export function isSoldOut(item: StockedItem): boolean {
  return getStockStatus(item).level === "out";
}

/**
 * The most of one item a single basket line may ask for: the line maximum, capped
 * by what's on hand for a counted item (at least one, so the control is usable —
 * checkout is what refuses a shortfall).
 */
export function maxLineQuantity(item: StockedItem): number {
  if (item.madeToOrder) return MAX_LINE_QUANTITY;
  return Math.min(MAX_LINE_QUANTITY, Math.max(item.stockQuantity, 1));
}
