import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { isExpenseTarget, MAX_EXPENSE_DESCRIPTION_LENGTH, type Expense, type PaymentSource, type Supplier } from "../../entities/Expense";
import { reversalOf } from "../../entities/Ledger";
import { expenseEntry, expensePaymentEntry } from "../../entities/Postings";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { IExpenseRepository, NewSupplier } from "../../repositories/IExpenseRepository";
import type { ILedgerRepository } from "../../repositories/ILedgerRepository";

export type RecordExpenseInput = {
  date: string;
  supplierId?: string;
  accountCode: string;
  description: string;
  amount: number;
  vatAmount: number;
  /** Paid on the spot; omitted means it's owed to the supplier. */
  paidFrom?: PaymentSource;
};

const expenseLabel = (expense: Pick<Expense, "number" | "description">) => `EX-${expense.number} ${expense.description}`;

function audit(actor: ActivityActor, action: "expense.recorded" | "expense.paid" | "expense.voided", changes: (e: Expense) => ReturnType<typeof singleChange>) {
  return (expense: Expense) => ({
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType: "expense" as const,
    entityId: expense.id,
    entityLabel: expenseLabel(expense),
    changes: changes(expense),
  });
}

/**
 * Record a bill or a purchase. The cost (net of VAT) goes to its account, the VAT
 * to VAT payable as input VAT, and the total either out of cash/bank or onto
 * accounts payable — all in the same transaction as the expense row.
 */
export class RecordExpense {
  constructor(
    private readonly expenses: IExpenseRepository,
    private readonly ledger: ILedgerRepository,
  ) {}

  async execute(input: RecordExpenseInput, actor: ActivityActor, now: Date = new Date()): Promise<Expense> {
    if (input.date > cafeDayOf(now)) throw new ValidationError("date", "That date is in the future.");
    const description = input.description.trim();
    if (!description || description.length > MAX_EXPENSE_DESCRIPTION_LENGTH) {
      throw new ValidationError("description", "Describe the expense (up to 300 characters).");
    }
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new ValidationError("amount", "Enter the amount.");
    if (!Number.isSafeInteger(input.vatAmount) || input.vatAmount < 0 || input.vatAmount >= input.amount) {
      throw new ValidationError("vatAmount", "VAT must be less than the total.");
    }
    const account = await this.ledger.getAccount(input.accountCode);
    if (!account?.isActive || !isExpenseTarget(account)) {
      throw new ValidationError("accountCode", "Choose an active expense, inventory or equipment account.");
    }

    return this.expenses.create(
      {
        date: input.date,
        supplierId: input.supplierId,
        accountCode: input.accountCode,
        description,
        amount: input.amount,
        vatAmount: input.vatAmount,
        paidFrom: input.paidFrom,
        createdById: actor.id,
        createdByName: actor.name,
      },
      (expense) => [expenseEntry(expense, actor)],
      audit(actor, "expense.recorded", (expense) => singleChange("amount", null, expense.amount)),
    );
  }
}

/** Pay an owed expense from cash or the bank: clears accounts payable, books the money out. */
export class PayExpense {
  constructor(private readonly expenses: IExpenseRepository) {}

  async execute(id: string, source: PaymentSource, paidOn: string, actor: ActivityActor, now: Date = new Date()): Promise<Expense> {
    const expense = await this.expenses.getExpense(id);
    if (!expense) throw new NotFoundError("expense", id);
    if (expense.status !== "unpaid") throw new ConflictError("INVALID_TRANSITION", `This expense is already ${expense.status}.`);
    if (paidOn > cafeDayOf(now)) throw new ValidationError("paidOn", "That date is in the future.");
    if (paidOn < expense.date) throw new ValidationError("paidOn", "An expense can't be paid before it was incurred.");

    return this.expenses.pay(
      id,
      source,
      paidOn,
      (paid) => [expensePaymentEntry(paid, source, paidOn, actor)],
      audit(actor, "expense.paid", () => singleChange("status", "unpaid", "paid")),
    );
  }
}

/**
 * Void an expense entered by mistake: every entry it posted (and its payment, if
 * paid) is reversed today, so a closed period stays closed and the history shows
 * both the mistake and its correction.
 */
export class VoidExpense {
  constructor(private readonly expenses: IExpenseRepository) {}

  async execute(id: string, reason: string, actor: ActivityActor, now: Date = new Date()): Promise<Expense> {
    const expense = await this.expenses.getExpense(id);
    if (!expense) throw new NotFoundError("expense", id);
    if (expense.status === "void") throw new ConflictError("INVALID_TRANSITION", "This expense is already void.");
    const today = cafeDayOf(now);
    const why = reason.trim() || `EX-${expense.number} voided`;

    return this.expenses.void(
      id,
      (entry) => reversalOf(entry, today, why, actor),
      audit(actor, "expense.voided", () => singleChange("status", expense.status, "void")),
    );
  }
}

/** Add or edit a supplier. Suppliers are never deleted — past bills keep their name. */
export class SaveSupplier {
  constructor(private readonly expenses: IExpenseRepository) {}

  async create(input: NewSupplier): Promise<Supplier> {
    return this.expenses.createSupplier(clean(input));
  }

  async update(id: string, input: NewSupplier & { isActive: boolean }): Promise<Supplier> {
    return this.expenses.updateSupplier(id, { ...clean(input), isActive: input.isActive });
  }
}

function clean(input: NewSupplier): NewSupplier {
  const name = input.name.trim();
  if (!name) throw new ValidationError("name", "Enter the supplier's name.");
  return { name, phone: input.phone?.trim() || undefined, note: input.note?.trim() || undefined };
}
