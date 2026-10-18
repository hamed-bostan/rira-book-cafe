import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { MAX_EXPENSE_DESCRIPTION_LENGTH, type Expense } from "../../entities/Expense";
import {
  countEntry,
  openingStockEntry,
  wasteEntry,
  type InventorySummary,
  type StockMovement,
} from "../../entities/Inventory";
import { SYSTEM_ACCOUNTS } from "../../entities/Ledger";
import { expenseEntry } from "../../entities/Postings";
import { ValidationError } from "../../errors/ValidationError";

import type {
  IInventoryRepository,
  OpeningStockInput,
  StockCountInput,
  StockReceiptInput,
  WasteInput,
} from "../../repositories/IInventoryRepository";
import type { ILedgerRepository } from "../../repositories/ILedgerRepository";

/** The most lines one delivery or count may carry. */
export const MAX_STOCK_LINES = 200;

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
 * Receive a delivery. The bill is booked to Inventory (net) and VAT, owed to the
 * supplier or paid on the spot; the goods come into stock at cost.
 */
export class ReceiveStock {
  constructor(private readonly inventory: IInventoryRepository) {}

  async execute(
    input: Omit<StockReceiptInput, "createdById" | "createdByName">,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<Expense> {
    assertDate(input.date, now);
    assertLines(input.lines);
    for (const line of input.lines) {
      if (!(line.quantity > 0)) throw new ValidationError("lines", "Each quantity must be more than zero.");
      if (!Number.isSafeInteger(line.cost) || line.cost < 0)
        throw new ValidationError("lines", "Enter what each line cost.");
    }
    const net = input.lines.reduce((sum, line) => sum + line.cost, 0);
    if (net <= 0) throw new ValidationError("lines", "The delivery's total must be more than zero.");
    if (!Number.isSafeInteger(input.vatAmount) || input.vatAmount < 0)
      throw new ValidationError("vatAmount", "Enter the VAT on the invoice.");
    const description = input.description.trim();
    if (!description || description.length > MAX_EXPENSE_DESCRIPTION_LENGTH)
      throw new ValidationError("description", "Describe the delivery.");

    return this.inventory.receive(
      { ...input, description, createdById: actor.id, createdByName: actor.name },
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
    );
  }
}

/** A physical count: stock is set to what's on the shelves; the difference hits the P&L as variance. */
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
    );
  }
}

/** Stock already on hand when tracking starts — the owner's investment in kind. */
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
    return this.inventory.recordOpening(input, (event) => openingStockEntry(event, actor), actor);
  }
}

export class SetReorderLevel {
  constructor(private readonly inventory: IInventoryRepository) {}

  async execute(ingredientId: string, reorderLevel: number | null): Promise<void> {
    if (reorderLevel !== null && !(reorderLevel >= 0))
      throw new ValidationError("reorderLevel", "Enter a level of zero or more.");
    await this.inventory.setReorderLevel(ingredientId, reorderLevel);
  }
}
