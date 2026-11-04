import { SYSTEM_ACCOUNTS, type NewJournalEntry } from "./Ledger";

import type { PurchaseUnit, RecipeLine } from "./Pricing";

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
 *   opening  — stock on hand when tracking starts: +qty, +cost  (Cr 3100 owner's capital);
 *              once per item, before anything else has moved it
 *   return   — sold units a refund put back on the shelf: +qty, +cost (Cr 5100 cost of sales)
 *   adjustment — a manual ± with a reason code: ±qty, ±avg×qty (the reason's account,
 *              see ADJUSTMENT_ACCOUNTS)
 *   return_to_supplier — goods sent back against a credit note: −qty, −avg×qty
 *              (Dr payable / refund, see supplierReturnEntry)
 *
 * One location only. The cafe keeps one store room behind one counter, so stock is
 * a single figure per item; there are no transfers because there's nowhere to
 * transfer to. A second location would need on-hand per (item, location), a
 * location on every movement and a transfer kind that moves value without
 * touching the books — a schema change, not a reason code.
 */

export const STOCK_MOVEMENT_KINDS = [
  "opening",
  "receipt",
  "sale",
  "waste",
  "count",
  "return",
  "adjustment",
  "return_to_supplier",
] as const;
export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

export const INVENTORY_ACCOUNTS = {
  waste: "5200",
  variance: "5300",
  /** A running cost of the team, not of what was sold. */
  staffMeals: "6410",
  /** Given away to taste or to promote: a running cost, like marketing. */
  samples: "6610",
} as const;

/**
 * Why stock was adjusted by hand. A closed list, so the P&L can put each where it
 * belongs and the movements can be filtered by it:
 *
 *   found      — turned up (a misplaced case): in, valued at average cost → 5300 variance
 *   damaged    — broken or spoiled beyond a waste write-off's routine → 5200 waste
 *   staffMeal  — the team ate or drank it → 6410 staff meals (operating expense)
 *   sampling   — tastings, giveaways → 6610 samples (operating expense)
 *   correction — a typing mistake in an earlier entry, either way → 5300 variance
 *   other      — anything else, with a note saying what → 5300 variance
 *
 * Found and correction go to variance because they correct what the system
 * thought was there, exactly as a count does; staff meals and samples are real
 * consumption the cafe chose, so they're running costs rather than cost of sales
 * (no sale earned them) and show up in the pricing advisor's overhead.
 */
export const ADJUSTMENT_REASONS = ["found", "damaged", "staffMeal", "sampling", "correction", "other"] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const ADJUSTMENT_ACCOUNTS: Record<AdjustmentReason, string> = {
  found: INVENTORY_ACCOUNTS.variance,
  damaged: INVENTORY_ACCOUNTS.waste,
  staffMeal: INVENTORY_ACCOUNTS.staffMeals,
  sampling: INVENTORY_ACCOUNTS.samples,
  correction: INVENTORY_ACCOUNTS.variance,
  other: INVENTORY_ACCOUNTS.variance,
};

/** Which way each reason may move stock: found stock comes in, what was eaten goes out. */
export const ADJUSTMENT_DIRECTIONS: Record<AdjustmentReason, "in" | "out" | "either"> = {
  found: "in",
  damaged: "out",
  staffMeal: "out",
  sampling: "out",
  correction: "either",
  other: "either",
};

/** Whether a signed adjustment fits its reason: no "found" stock going out, no staff meal coming in. */
export function adjustmentFitsReason(reason: AdjustmentReason, quantity: number): boolean {
  if (quantity === 0) return false;
  const direction = ADJUSTMENT_DIRECTIONS[reason];
  return direction === "either" || (direction === "in" ? quantity > 0 : quantity < 0);
}

/** "Other" must say what happened; the rest may. */
export function adjustmentNeedsNote(reason: AdjustmentReason): boolean {
  return reason === "other";
}

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

/**
 * A made-to-order item's warning: the recipe ingredient that most needs attention,
 * and whether it's out or running low.
 */
export type IngredientAlert = { level: "out" | "low"; ingredient: string };

/**
 * The warning a made-to-order item carries, from its recipe's ingredients (as
 * {@link stockLevel} reads each one). The worst wins — any ingredient out beats
 * any running low — and among equals the first by name, so the row names the same
 * ingredient every time. `undefined` when every ingredient is fine, or there's no
 * recipe.
 */
export function ingredientAlertFor(
  ingredients: readonly { name: string; onHand: number; reorderLevel?: number }[],
): IngredientAlert | undefined {
  let alert: IngredientAlert | undefined;
  for (const ingredient of ingredients) {
    const level = stockLevel(ingredient);
    if (level === "ok") continue;
    const candidate: IngredientAlert = { level, ingredient: ingredient.name };
    if (!alert || comesFirst(candidate, alert)) alert = candidate;
  }
  return alert;
}

/** Whether `a` is the warning to show over `b`: out before low, then by name. */
function comesFirst(a: IngredientAlert, b: IngredientAlert): boolean {
  if (a.level !== b.level) return a.level === "out";
  return a.ingredient.localeCompare(b.ingredient) < 0;
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
  /** The order, receipt (expense), count or supplier return it belongs to. */
  referenceId?: string;
  note?: string;
  /** An adjustment's reason code. */
  reason?: AdjustmentReason;
  /**
   * On hand right after this movement — read when the list is narrowed to one item,
   * where it's that item's running balance. Absent otherwise.
   */
  balanceAfter?: number;
  createdByName: string;
  createdAt: string;
};

/**
 * Each movement's running balance, newest first: the newest leaves `latestBalance`
 * on hand (what was there right after it), and each older one left what the newer
 * one started from. Walks back from a known balance, so a page in the middle of
 * the history reads right as long as it's given the balance after its first row.
 */
export function withRunningBalance<T extends Pick<StockMovement, "quantity">>(
  newestFirst: readonly T[],
  latestBalance: number,
): (T & { balanceAfter: number })[] {
  let balance = latestBalance;
  return newestFirst.map((movement) => {
    const row = { ...movement, balanceAfter: roundQuantity(balance) };
    balance -= movement.quantity;
    return row;
  });
}

/**
 * What was on hand at the end of a past day: on hand now, less everything that
 * moved after it. A count dated in the past is compared against this — not against
 * today's figure, which already carries the sales and deliveries since — and the
 * difference it finds is then applied to today's stock.
 */
export function onHandAtEndOf(onHandNow: number, movedSince: number): number {
  return roundQuantity(onHandNow - movedSince);
}

type Actor = { id: string; name: string };

/**
 * A manual adjustment's entry: stock out is a debit to the reason's account (a
 * loss, or a staff meal's or tasting's cost), stock in a credit to it. `null` at
 * zero value — a free item moved, nothing to book.
 */
export function adjustmentEntry(
  input: { id: string; date: string; value: number; reason: AdjustmentReason; description: string },
  actor: Actor,
): NewJournalEntry | null {
  if (input.value === 0) return null;
  const amount = Math.abs(input.value);
  const account = ADJUSTMENT_ACCOUNTS[input.reason];
  return {
    date: input.date,
    description: input.description,
    source: "stockAdjustment",
    sourceId: input.id,
    uniqueKey: `stock:${input.id}:adjustment`,
    lines:
      input.value < 0
        ? [
            { accountCode: account, debit: amount, credit: 0 },
            { accountCode: SYSTEM_ACCOUNTS.inventory, debit: 0, credit: amount },
          ]
        : [
            { accountCode: SYSTEM_ACCOUNTS.inventory, debit: amount, credit: 0 },
            { accountCode: account, debit: 0, credit: amount },
          ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * How a supplier's credit for returned goods is settled: first against what's
 * still owed on the delivery's bill (it simply owes less), and whatever the bill
 * can't absorb — it was paid already, or the credit is bigger, or no bill was
 * named — comes back as money.
 */
export function settleSupplierCredit(credit: number, owedOnBill: number): { applied: number; refunded: number } {
  const applied = Math.max(0, Math.min(credit, owedOnBill));
  return { applied, refunded: credit - applied };
}

/**
 * Stock sent back to a supplier against a credit note. The goods leave Inventory
 * at average cost (what they're carried at), the credit's VAT reverses the input
 * VAT the bill claimed, and the credit itself lowers what's owed (Dr payable) or
 * comes back as money (Dr cash/bank). A credit worth more or less than the goods'
 * average cost is a purchase price difference, through inventory variance — the
 * same account a count's difference goes to — so Inventory always moves by
 * exactly what the stock list lost.
 *
 *   Dr 2100 payable   applied          Cr 1200 inventory   stock value
 *   Dr 1110/1120      refunded         Cr 2200 VAT         VAT on the credit
 *   Dr/Cr 5300 variance — the difference
 */
export function supplierReturnEntry(
  input: {
    id: string;
    date: string;
    applied: number;
    refunded: number;
    refundedTo?: "cash" | "bank";
    vatAmount: number;
    stockValue: number;
    supplierName: string;
    description: string;
  },
  actor: Actor,
): NewJournalEntry {
  const credit = input.applied + input.refunded;
  const difference = credit - input.vatAmount - input.stockValue;
  const refundAccount = input.refundedTo === "bank" ? SYSTEM_ACCOUNTS.bank : SYSTEM_ACCOUNTS.cash;
  return {
    date: input.date,
    description: input.description,
    source: "supplierReturn",
    sourceId: input.id,
    uniqueKey: `supplierReturn:${input.id}`,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.accountsPayable, debit: input.applied, credit: 0, memo: input.supplierName },
      { accountCode: refundAccount, debit: input.refunded, credit: 0 },
      { accountCode: INVENTORY_ACCOUNTS.variance, debit: Math.max(0, -difference), credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.inventory, debit: 0, credit: input.stockValue },
      { accountCode: SYSTEM_ACCOUNTS.vatPayable, debit: 0, credit: input.vatAmount },
      { accountCode: INVENTORY_ACCOUNTS.variance, debit: 0, credit: Math.max(0, difference) },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** One line of a supplier return: what went back and what it was carried at. */
export type SupplierReturnLine = { ingredientId: string; ingredientName: string; quantity: number; value: number };

/** Stock sent back to a supplier, and how its credit was settled. */
export type SupplierReturn = {
  id: string;
  /** Sequential, what staff quote ("SR-3"). */
  number: number;
  date: string;
  supplierId: string;
  supplierName: string;
  /** The delivery it came from, when one was named. */
  expenseId?: string;
  expenseNumber?: number;
  /** The credit note's total, VAT included. */
  creditAmount: number;
  vatAmount: number;
  /** The part that lowered what's owed on the bill. */
  appliedAmount: number;
  /** The part that came back as money. */
  refundedAmount: number;
  refundedTo?: "cash" | "bank";
  /** What the goods were carried at in stock. */
  stockValue: number;
  note?: string;
  lines: SupplierReturnLine[];
  createdByName: string;
  createdAt: string;
};

/** A return as someone without access to the books sees it: what went back, not what it was worth. */
export function withoutReturnCosts(item: SupplierReturn): SupplierReturn {
  return {
    ...item,
    creditAmount: 0,
    vatAmount: 0,
    appliedAmount: 0,
    refundedAmount: 0,
    stockValue: 0,
    lines: item.lines.map((line) => ({ ...line, value: 0 })),
  };
}

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
  /** What a delivery tops it up to. */
  parLevel?: number;
  /** How it's bought; the first is the pack the "To order" list rounds up to. */
  purchaseUnits: PurchaseUnit[];
  /** Who it's usually bought from. */
  supplierId?: string;
  supplierName?: string;
  /** One unit at the last price paid — what recipes are costed at with nothing on hand. */
  lastPurchaseCost: number;
  isActive: boolean;
  level: StockLevel;
  /** Whether any stock has ever moved — once it has, opening stock is no longer for it. */
  hasHistory: boolean;
};

/** What to order of one item: base units, and in packs when it has a purchase unit. */
export type OrderSuggestion = {
  /** In the item's base unit; zero when it's already at or above par. */
  quantity: number;
  /** The first purchase unit, and how many of it — the quantity rounded up to whole packs. */
  packs?: { count: number; unit: PurchaseUnit };
};

/**
 * How much to order to bring an item back to its par level: par − on hand (on hand
 * below zero counts as zero — what's owed to the shelf was already sold), rounded
 * up to whole packs of the item's first purchase unit, since that's how it's
 * bought. `null` without a par level: there's nothing to top up to.
 */
export function suggestOrder(item: Pick<StockItem, "onHand" | "parLevel" | "purchaseUnits">): OrderSuggestion | null {
  if (item.parLevel === undefined) return null;
  const short = roundQuantity(item.parLevel - Math.max(item.onHand, 0));
  if (short <= 0) return { quantity: 0 };
  const unit = item.purchaseUnits[0];
  if (!unit) return { quantity: short };
  const count = Math.ceil(roundQuantity(short / unit.factor));
  return { quantity: roundQuantity(count * unit.factor), packs: { count, unit } };
}

/** One supplier's part of the "To order" list. */
export type OrderGroup = {
  /** Absent for items with no usual supplier — listed last. */
  supplierId?: string;
  supplierName?: string;
  lines: { item: StockItem; suggestion: OrderSuggestion | null }[];
};

/**
 * Everything that needs ordering — active items running low or out — grouped by
 * who it's usually bought from, suppliers by name and the unassigned last, items
 * by name within each.
 */
export function orderList(items: readonly StockItem[], locale = "en"): OrderGroup[] {
  const groups = new Map<string, OrderGroup>();
  const due = items
    .filter((item) => item.isActive && item.level !== "ok")
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  for (const item of due) {
    const key = item.supplierId ?? "";
    const group = groups.get(key) ?? { supplierId: item.supplierId, supplierName: item.supplierName, lines: [] };
    group.lines.push({ item, suggestion: suggestOrder(item) });
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.supplierId || !b.supplierId) return a.supplierId ? -1 : b.supplierId ? 1 : 0;
    return (a.supplierName ?? "").localeCompare(b.supplierName ?? "", locale);
  });
}

/**
 * The lines of an opening stock entry that are refused, by position: opening stock
 * is what was on the shelves when tracking started, so it's only for an item with
 * no movements yet. Recording it again would credit the owner's capital twice; an
 * item already tracked takes a delivery or a count instead.
 */
export function openingLinesRefused(
  lines: readonly { ingredientId: string }[],
  withHistory: ReadonlySet<string>,
): number[] {
  return lines.flatMap((line, index) => (withHistory.has(line.ingredientId) ? [index] : []));
}

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
    items: summary.items.map((item) => ({ ...item, averageCost: 0, value: 0, lastPurchaseCost: 0 })),
    stockValue: 0,
    booksValue: 0,
    difference: 0,
    costsVisible: false,
  };
}
