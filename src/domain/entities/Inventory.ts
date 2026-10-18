import { SYSTEM_ACCOUNTS, type NewJournalEntry } from "./Ledger";

import type { RecipeLine } from "./Pricing";

/**
 * Perpetual inventory at weighted average cost.
 *
 * Every stock item (an ingredient, or a resale good such as a book) carries what's
 * on hand, what that stock is worth, and its average cost. Every change is a stock
 * movement with a quantity and a value, and every value change is posted to the
 * Inventory account (1200) in the same transaction — so the stock list and the
 * books always agree:
 *
 *   receipt  — bought in:   +qty, +cost        (Dr 1200 via the supplier bill)
 *   sale     — used by sold items via their recipes: −qty, −avg×qty (Dr 5100 cost of sales)
 *   waste    — spoiled, spilled, expired:        −qty, −avg×qty (Dr 5200 waste)
 *   count    — physical count differs:           ±qty, ±avg×qty (5300 inventory variance)
 *   opening  — stock on hand when tracking starts: +qty, +cost  (Cr 3100 owner's capital)
 */

export const STOCK_MOVEMENT_KINDS = ["opening", "receipt", "sale", "waste", "count"] as const;
export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

export const INVENTORY_ACCOUNTS = {
  waste: "5200",
  variance: "5300",
} as const;

/** What's on hand and what it's worth. `value` is whole Toman and always matches the ledger. */
export type StockState = { onHand: number; value: number; averageCost: number };

export type StockLevel = "out" | "low" | "ok";

/**
 * Out at zero or below; low at or below the reorder level; otherwise fine. An item
 * without a reorder level is only ever "out" or "ok".
 */
export function stockLevel(item: { onHand: number; reorderLevel?: number }): StockLevel {
  if (item.onHand <= 0) return "out";
  if (item.reorderLevel !== undefined && item.onHand <= item.reorderLevel) return "low";
  return "ok";
}

/** Quantities are kept to 3 decimals (grams, millilitres) so float dust never accumulates. */
export function roundQuantity(quantity: number): number {
  return Math.round(quantity * 1000) / 1000;
}

/** Stock bought in: the average cost moves toward what was just paid. */
export function receiveStock(state: StockState, quantity: number, cost: number): StockState {
  const onHand = roundQuantity(state.onHand + quantity);
  const value = state.value + cost;
  // Whatever value was already held (including rounding left by earlier issues) is
  // spread over what's now on hand; with nothing on hand, the last price stands.
  const averageCost = onHand > 0 ? value / onHand : quantity > 0 ? cost / quantity : state.averageCost;
  return { onHand, value, averageCost };
}

/**
 * Stock going out at average cost. Returns the value taken off. Taking the last of
 * the stock takes all of its value, so no rounding residue is left behind.
 */
export function issueStock(state: StockState, quantity: number): { state: StockState; value: number } {
  const onHand = roundQuantity(state.onHand - quantity);
  const value = onHand === 0 ? state.value : Math.round(state.averageCost * quantity);
  return { state: { onHand, value: state.value - value, averageCost: state.averageCost }, value };
}

/** One stock item used by one order line. */
export type ConsumptionLine = { ingredientId: string; quantity: number; value: number };

/** What selling `quantity` of an item uses, and its cost per unit sold (whole Toman). */
export type ItemConsumption = { unitCost: number; lines: ConsumptionLine[] };

/**
 * What a sold item consumes, at each stock item's average cost. The cost is worked
 * out per serving and rounded to the Toman, then multiplied by the quantity — so the
 * value taken out of stock equals unit cost × quantity exactly, and cost of sales,
 * the stock value and the margin report all agree to the Toman.
 */
export function consumptionFor(
  recipe: readonly RecipeLine[],
  quantity: number,
  stock: ReadonlyMap<string, Pick<StockState, "averageCost">>,
): ItemConsumption {
  let unitCost = 0;
  const lines = recipe.map((line) => {
    const perServing = Math.round((stock.get(line.ingredientId)?.averageCost ?? 0) * line.quantity);
    unitCost += perServing;
    return {
      ingredientId: line.ingredientId,
      quantity: roundQuantity(line.quantity * quantity),
      value: perServing * quantity,
    };
  });
  return { unitCost, lines };
}

/** A recorded change to one stock item. */
export type StockMovement = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  kind: StockMovementKind;
  /** Signed: in is positive, out is negative. */
  quantity: number;
  /** Signed whole Toman, same sign as `quantity`. */
  value: number;
  date: string;
  /** The order, receipt (expense) or count it belongs to. */
  referenceId?: string;
  note?: string;
  createdByName: string;
  createdAt: string;
};

type Actor = { id: string; name: string };

/** Spoiled or spilled stock leaves inventory as an expense. */
export function wasteEntry(
  input: { id: string; date: string; value: number; description: string },
  actor: Actor,
): NewJournalEntry {
  return {
    date: input.date,
    description: input.description,
    source: "stockWaste",
    sourceId: input.id,
    uniqueKey: `stock:${input.id}:waste`,
    lines: [
      { accountCode: INVENTORY_ACCOUNTS.waste, debit: input.value, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.inventory, debit: 0, credit: input.value },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * A physical count's difference: a shortage (negative) is a loss, a surplus a gain,
 * both through the inventory variance account so they show on the P&L.
 */
export function countEntry(
  input: { id: string; date: string; variance: number; description: string },
  actor: Actor,
): NewJournalEntry | null {
  if (input.variance === 0) return null;
  const amount = Math.abs(input.variance);
  const shortage = input.variance < 0;
  return {
    date: input.date,
    description: input.description,
    source: "stockCount",
    sourceId: input.id,
    uniqueKey: `stock:${input.id}:count`,
    lines: shortage
      ? [
          { accountCode: INVENTORY_ACCOUNTS.variance, debit: amount, credit: 0 },
          { accountCode: SYSTEM_ACCOUNTS.inventory, debit: 0, credit: amount },
        ]
      : [
          { accountCode: SYSTEM_ACCOUNTS.inventory, debit: amount, credit: 0 },
          { accountCode: INVENTORY_ACCOUNTS.variance, debit: 0, credit: amount },
        ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** Stock already on the shelves when tracking starts: the owner's contribution in kind. */
export function openingStockEntry(
  input: { id: string; date: string; value: number; description: string },
  actor: Actor,
): NewJournalEntry {
  return {
    date: input.date,
    description: input.description,
    source: "stockOpening",
    sourceId: input.id,
    uniqueKey: `stock:${input.id}:opening`,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.inventory, debit: input.value, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.ownerCapital, debit: 0, credit: input.value },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** A stock item as the inventory screen shows it. */
export type StockItem = {
  id: string;
  name: string;
  unit: "g" | "ml" | "piece";
  onHand: number;
  averageCost: number;
  /** Whole Toman; the sum over all items equals the Inventory account. */
  value: number;
  reorderLevel?: number;
  isActive: boolean;
  level: StockLevel;
};

/** Inventory at a glance, with the check that stock and the books agree. */
export type InventorySummary = {
  items: StockItem[];
  lowCount: number;
  outCount: number;
  stockValue: number;
  /** The Inventory account (1200) balance today. */
  booksValue: number;
  /** Stock value − books; zero when everything flowed through stock. */
  difference: number;
  /** False when the viewer may not see costs (values are zeroed). */
  costsVisible: boolean;
};

/**
 * The summary as someone without access to the books sees it: quantities and
 * levels, but no costs or values.
 */
export function withoutStockCosts(summary: InventorySummary): InventorySummary {
  return {
    ...summary,
    items: summary.items.map((item) => ({ ...item, averageCost: 0, value: 0 })),
    stockValue: 0,
    booksValue: 0,
    difference: 0,
    costsVisible: false,
  };
}
