import {
  activityValue,
  singleChange,
  type ActivityAction,
  type ActivityActor,
  type ActivityChange,
} from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { MAX_EXPENSE_DESCRIPTION_LENGTH, type Expense } from "../../entities/Expense";
import {
  ADJUSTMENT_REASONS,
  adjustmentEntry,
  adjustmentFitsReason,
  adjustmentNeedsNote,
  countEntry,
  openingStockEntry,
  roundQuantity,
  supplierReturnEntry,
  wasteEntry,
  type InventorySummary,
  type StockMovement,
  type SupplierReturn,
} from "../../entities/Inventory";
import { SYSTEM_ACCOUNTS } from "../../entities/Ledger";
import { expenseEntry } from "../../entities/Postings";
import { toBaseQuantity } from "../../entities/Pricing";
import { ValidationError } from "../../errors/ValidationError";

import type { AuditHook } from "../../repositories/AuditHook";
import type {
  IInventoryRepository,
  OpeningStockInput,
  StockAdjustmentInput,
  StockChange,
  StockCountInput,
  StockReceiptInput,
  SupplierReturnInput,
  WasteInput,
} from "../../repositories/IInventoryRepository";
import type { ILedgerRepository } from "../../repositories/ILedgerRepository";

/** The most lines one delivery or count may carry. */
export const MAX_STOCK_LINES = 200;

/**
 * The activity entry for one stock item a hand-made stock change moved: what was
 * on hand before and after, what it was worth (redacted for viewers without
 * `accounting.view`), and the reason and note when there are any.
 */
export function stockChangeAudit(actor: ActivityActor, action: ActivityAction): AuditHook<StockChange> {
  return (change) => {
    const changes: ActivityChange[] = [
      { field: "onHand", before: activityValue(change.onHandBefore), after: activityValue(change.onHandAfter) },
      { field: "value", before: null, after: activityValue(change.value) },
    ];
    if (change.reason) changes.push({ field: "reason", before: null, after: change.reason });
    if (change.note) changes.push({ field: "note", before: null, after: activityValue(change.note) });
    return {
      actorId: actor.id,
      actorName: actor.name,
      action,
      entityType: "stockItem",
      entityId: change.ingredientId,
      entityLabel: change.ingredientName,
      changes,
    };
  };
}

function assertDate(day: string, now: Date): void {
  if (day > cafeDayOf(now)) throw new ValidationError("date", "That date is in the future.");
}

function assertLines<T>(lines: readonly T[]): void {
  if (lines.length === 0) throw new ValidationError("lines", "Add at least one item.");
  if (lines.length > MAX_STOCK_LINES) throw new ValidationError("lines", "Too many lines for one document.");
}

/**
 * Stock on hand, what's running low, and whether stock and the books agree: the
 * stock value should equal the Inventory account exactly when every purchase came
 * in as a delivery. A difference means something was booked to Inventory another
 * way (e.g. a manual journal entry) and is worth looking at.
 */
export class GetInventory {
  constructor(
    private readonly inventory: IInventoryRepository,
    private readonly ledger: ILedgerRepository,
  ) {}

  async execute(): Promise<InventorySummary> {
    const [items, movements] = await Promise.all([this.inventory.listStock(true), this.ledger.movements()]);
    const books = movements.find((row) => row.accountCode === SYSTEM_ACCOUNTS.inventory);
    const booksValue = books ? books.debit - books.credit : 0;
    const stockValue = items.reduce((sum, item) => sum + item.value, 0);
    const active = items.filter((item) => item.isActive);
    return {
      items,
      lowCount: active.filter((item) => item.level === "low").length,
      outCount: active.filter((item) => item.level === "out").length,
      stockValue,
      booksValue,
      difference: stockValue - booksValue,
      costsVisible: true,
    };
  }
}

/**
 * A delivery line as typed: a quantity in the item's base unit or in one of its
 * purchase units, and a cost for the whole line or per unit typed.
 */
export type ReceiptEntryLine = {
  ingredientId: string;
  quantity: number;
  /** A purchase unit's name; blank or absent is the base unit. */
  purchaseUnit?: string;
  cost: number;
  /** `cost` is per unit typed (per bag, per carton), not for the line. */
  costPerUnit?: boolean;
};

export type ReceiptEntry = Omit<StockReceiptInput, "createdById" | "createdByName" | "lines"> & {
  lines: ReceiptEntryLine[];
};

/**
 * Receive a delivery. The bill is booked to Inventory (net) and VAT, owed to the
 * supplier or paid on the spot; the goods come into stock at cost.
 *
 * A line typed in a purchase unit ("3 bags", 450,000 a bag) is brought into the
 * base unit here, from the item's own units as stored — the client only names the
 * unit — so stock and the average cost stay per gram, millilitre or piece; the
 * movement's note keeps what was typed.
 */
export class ReceiveStock {
  constructor(private readonly inventory: IInventoryRepository) {}

  async execute(input: ReceiptEntry, actor: ActivityActor, now: Date = new Date()): Promise<Expense> {
    assertDate(input.date, now);
    assertLines(input.lines);
    for (const line of input.lines) {
      if (!(line.quantity > 0)) throw new ValidationError("lines", "Each quantity must be more than zero.");
      if (!Number.isSafeInteger(line.cost) || line.cost < 0)
        throw new ValidationError("lines", "Enter what each line cost.");
    }
    const lines = await this.toBaseLines(input.lines);
    const net = lines.reduce((sum, line) => sum + line.cost, 0);
    if (net <= 0) throw new ValidationError("lines", "The delivery's total must be more than zero.");
    if (!Number.isSafeInteger(input.vatAmount) || input.vatAmount < 0)
      throw new ValidationError("vatAmount", "Enter the VAT on the invoice.");
    const description = input.description.trim();
    if (!description || description.length > MAX_EXPENSE_DESCRIPTION_LENGTH)
      throw new ValidationError("description", "Describe the delivery.");

    return this.inventory.receive(
      { ...input, lines, description, createdById: actor.id, createdByName: actor.name },
      (expense) => [expenseEntry(expense, actor)],
      (expense) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "expense.recorded",
        entityType: "expense",
        entityId: expense.id,
        entityLabel: `EX-${expense.number} ${expense.description}`,
        changes: singleChange("amount", null, expense.amount),
      }),
    );
  }

  /** Every line in base units, its cost for the whole line. Reads the items only when a pack was typed. */
  private async toBaseLines(lines: readonly ReceiptEntryLine[]): Promise<StockReceiptInput["lines"]> {
    const packed = lines.some((line) => line.purchaseUnit);
    const items = packed ? new Map((await this.inventory.listStock(true)).map((item) => [item.id, item])) : null;
    return lines.map((line, index) => {
      const cost = line.costPerUnit ? Math.round(line.cost * line.quantity) : line.cost;
      if (!Number.isSafeInteger(cost)) throw new ValidationError("lines", "Enter what each line cost.");
      if (!line.purchaseUnit) return { ingredientId: line.ingredientId, quantity: line.quantity, cost };
      const units = items?.get(line.ingredientId)?.purchaseUnits ?? [];
      const quantity = toBaseQuantity(line.quantity, line.purchaseUnit, units);
      if (quantity === null || !(quantity > 0))
        throw new ValidationError(`lines.${index}.purchaseUnit`, "That item isn't bought in that unit.");
      return { ingredientId: line.ingredientId, quantity, cost, note: `${line.quantity} × ${line.purchaseUnit}` };
    });
  }
}

export class RecordWaste {
  constructor(private readonly inventory: IInventoryRepository) {}

  async execute(input: WasteInput, actor: ActivityActor, now: Date = new Date()): Promise<StockMovement> {
    assertDate(input.date, now);
    if (!(input.quantity > 0)) throw new ValidationError("quantity", "Enter how much was wasted.");
    return this.inventory.recordWaste(
      { ...input, note: input.note?.trim() || undefined },
      (event) => wasteEntry(event, actor),
      actor,
      stockChangeAudit(actor, "stockItem.wasted"),
    );
  }
}

/**
 * A physical count: stock is set to what's on the shelves; the difference hits the
 * P&L as variance.
 *
 * Backdated counts: a count dated in the past (the sheet from last night, entered
 * this morning) describes the shelves at the end of that day, so each item's
 * difference is found against what was on hand then — today's figure less every
 * movement dated after the count — not against today's, which already carries the
 * sales and deliveries since and would book them as a false variance. The
 * difference is then applied to today's stock (the movement and its entry are
 * dated the count's day), so what's on hand now = then-counted + everything since.
 */
export class CountStock {
  constructor(private readonly inventory: IInventoryRepository) {}

  async execute(
    input: StockCountInput,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<{ id: string; variance: number; adjusted: number }> {
    assertDate(input.date, now);
    assertLines(input.lines);
    if (input.lines.some((line) => !(line.counted >= 0)))
      throw new ValidationError("lines", "Counts can't be negative.");
    if (new Set(input.lines.map((line) => line.ingredientId)).size !== input.lines.length)
      throw new ValidationError("lines", "Each item is counted once.");
    return this.inventory.recordCount(
      { ...input, note: input.note?.trim() || undefined },
      (event) =>
        countEntry({ id: event.id, date: event.date, variance: event.value, description: event.description }, actor),
      actor,
      stockChangeAudit(actor, "stockItem.counted"),
    );
  }
}

/**
 * Stock already on hand when tracking starts — the owner's investment in kind.
 * Once per item: an item that has moved before is refused, line by line.
 */
export class RecordOpeningStock {
  constructor(private readonly inventory: IInventoryRepository) {}

  async execute(
    input: OpeningStockInput,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<{ id: string; value: number }> {
    assertDate(input.date, now);
    assertLines(input.lines);
    for (const line of input.lines) {
      if (!(line.quantity > 0)) throw new ValidationError("lines", "Each quantity must be more than zero.");
      if (!Number.isSafeInteger(line.cost) || line.cost < 0)
        throw new ValidationError("lines", "Enter what each line is worth.");
    }
    return this.inventory.recordOpening(
      input,
      (event) => openingStockEntry(event, actor),
      actor,
      stockChangeAudit(actor, "stockItem.openingRecorded"),
    );
  }
}

/**
 * A manual change with a reason code (see ADJUSTMENT_REASONS): found stock comes
 * in, staff meals, tastings and breakage go out, a correction either way — each at
 * average cost, posted to the reason's account.
 */
export class AdjustStock {
  constructor(private readonly inventory: IInventoryRepository) {}

  async execute(input: StockAdjustmentInput, actor: ActivityActor, now: Date = new Date()): Promise<StockMovement> {
    assertDate(input.date, now);
    if (!(ADJUSTMENT_REASONS as readonly string[]).includes(input.reason))
      throw new ValidationError("reason", "Choose a reason.");
    if (!Number.isFinite(input.quantity) || roundQuantity(input.quantity) === 0)
      throw new ValidationError("quantity", "Enter how much to add or take away.");
    if (!adjustmentFitsReason(input.reason, input.quantity))
      throw new ValidationError("quantity", "adjustmentDirection");
    const note = input.note?.trim() || undefined;
    if (adjustmentNeedsNote(input.reason) && !note) throw new ValidationError("note", "adjustmentNoteRequired");
    return this.inventory.adjust(
      { ...input, quantity: roundQuantity(input.quantity), note },
      (event) =>
        adjustmentEntry(
          { id: event.id, date: event.date, value: event.value, reason: input.reason, description: event.description },
          actor,
        ),
      actor,
      stockChangeAudit(actor, "stockItem.adjusted"),
    );
  }
}

/**
 * Send stock back to a supplier against their credit note. Each line leaves at
 * average cost (never more than is on hand — checked under the rows' locks); the
 * credit first lowers what's still owed on the delivery's bill, and the rest
 * comes back as money, so the payable never goes negative. See
 * `supplierReturnEntry` for the double entry.
 */
export class ReturnToSupplier {
  constructor(private readonly inventory: IInventoryRepository) {}

  async execute(input: SupplierReturnInput, actor: ActivityActor, now: Date = new Date()): Promise<SupplierReturn> {
    assertDate(input.date, now);
    assertLines(input.lines);
    if (!input.supplierId) throw new ValidationError("supplierId", "Choose the supplier.");
    for (const line of input.lines) {
      if (!(line.quantity > 0)) throw new ValidationError("lines", "Each quantity must be more than zero.");
    }
    if (new Set(input.lines.map((line) => line.ingredientId)).size !== input.lines.length)
      throw new ValidationError("lines", "Each item is returned once.");
    if (!Number.isSafeInteger(input.creditAmount) || input.creditAmount < 0)
      throw new ValidationError("creditAmount", "Enter the credit.");
    if (!Number.isSafeInteger(input.vatAmount) || input.vatAmount < 0 || input.vatAmount > input.creditAmount)
      throw new ValidationError("vatAmount", "vatOverCredit");
    const note = input.note?.trim() || undefined;

    return this.inventory.returnToSupplier(
      { ...input, note },
      (posting) =>
        supplierReturnEntry(
          {
            id: posting.id,
            date: posting.date,
            applied: posting.applied,
            refunded: posting.refunded,
            refundedTo: posting.refundedTo,
            vatAmount: posting.vatAmount,
            stockValue: posting.stockValue,
            supplierName: posting.supplierName,
            description: `SR-${posting.number} — returned to ${posting.supplierName}${
              posting.expenseNumber ? ` (EX-${posting.expenseNumber})` : ""
            }${note ? ` — ${note}` : ""}`,
          },
          actor,
        ),
      actor,
      stockChangeAudit(actor, "stockItem.returnedToSupplier"),
    );
  }
}

/**
 * Put every book for sale under stock in one go. A book only books cost of sales
 * through a recipe, and until now that meant a stock item and a one-line recipe per
 * title by hand. Copies on the shelf come in at the book's cost price — the opening
 * stock rule, so the owner's capital takes the other side — and a book with no cost
 * price comes in at zero, to pick up its real cost with the next delivery.
 */
export class TrackBooksInStock {
  constructor(private readonly inventory: IInventoryRepository) {}

  async execute(actor: ActivityActor, now: Date = new Date()): Promise<{ tracked: number; value: number }> {
    const books = await this.inventory.listUntrackedBooks();
    if (books.length === 0) return { tracked: 0, value: 0 };
    return this.inventory.trackBooks(books, cafeDayOf(now), (event) => openingStockEntry(event, actor), actor);
  }
}

export class SetReorderLevel {
  constructor(private readonly inventory: IInventoryRepository) {}

  async execute(ingredientId: string, reorderLevel: number | null, actor: ActivityActor): Promise<void> {
    if (reorderLevel !== null && !(reorderLevel >= 0))
      throw new ValidationError("reorderLevel", "Enter a level of zero or more.");
    await this.inventory.setReorderLevel(ingredientId, reorderLevel, (item) =>
      item.before === item.after
        ? null
        : {
            actorId: actor.id,
            actorName: actor.name,
            action: "stockItem.updated",
            entityType: "stockItem",
            entityId: item.id,
            entityLabel: item.name,
            changes: singleChange("reorderLevel", item.before, item.after),
          },
    );
  }
}
