/**
 * Stock presentation rules — one source of truth for how on-hand quantity maps to
 * the storefront's three states, shared by every read-side surface (cards, detail
 * panel) so "out of stock" and "only N left" never diverge between them. Framework-
 * free, so it's importable from anywhere in the app.
 */

/** At or below this many units on hand (but above 0), the storefront nudges with "only N left". */
export const LOW_STOCK_THRESHOLD = 5;

export type StockStatus =
  /** Nothing on hand — add-to-cart is blocked and checkout can't oversell. */
  | { level: "out" }
  /** Running low (1…LOW_STOCK_THRESHOLD) — sellable, but surfaced with an "only N left" nudge. */
  | { level: "low"; quantity: number }
  /** Comfortable stock — no special messaging. */
  | { level: "in"; quantity: number };

/** Classify on-hand units into a storefront stock state. Negative/NaN is treated as out of stock (safe). */
export function getStockStatus(stockQuantity: number): StockStatus {
  if (!(stockQuantity > 0)) return { level: "out" };
  if (stockQuantity <= LOW_STOCK_THRESHOLD) return { level: "low", quantity: stockQuantity };
  return { level: "in", quantity: stockQuantity };
}
