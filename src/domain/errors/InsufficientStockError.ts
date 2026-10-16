/** One line that couldn't be filled: what was asked for and how many are left. */
export type StockShortfall = {
  productId: string;
  name: string;
  available: number;
  requested: number;
};

/**
 * An order asked for more of something than is on hand (or the item sold out
 * between the menu loading and the order landing). Nothing was changed — the
 * placement is all-or-nothing. The presentation layer answers 409.
 */
export class InsufficientStockError extends Error {
  constructor(
    public readonly shortfalls: StockShortfall[],
    options?: { cause?: unknown },
  ) {
    super(
      `Not enough stock for: ${shortfalls.map((s) => `${s.name} (${s.available} left, ${s.requested} requested)`).join(", ")}.`,
      options,
    );
    this.name = "InsufficientStockError";
  }
}
