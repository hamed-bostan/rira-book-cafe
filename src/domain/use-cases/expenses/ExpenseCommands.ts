import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import {
  amountOwed,
  isExpenseTarget,
  isReceiptUrl,
  MAX_EXPENSE_DESCRIPTION_LENGTH,
  type Expense,
  type PaymentSource,
  type Supplier,
} from "../../entities/Expense";
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
  /** A receipt already uploaded to the receipts folder. */
  receiptUrl?: string;
  /** The month of a recurring bill this records. */
  recurring?: { billId: string; period: string };
};

/** The rules a bill's figures keep, whether it's being recorded or set up to recur. Returns the description, trimmed. */
export function assertBillFigures(input: Pick<RecordExpenseInput, "description" | "amount" | "vatAmount">): string {
  const description = input.description.trim();
  if (!description || description.length > MAX_EXPENSE_DESCRIPTION_LENGTH) {
    throw new ValidationError("description", "Describe the expense (up to 300 characters).");
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw new ValidationError("amount", "Enter the amount.");
  if (!Number.isSafeInteger(input.vatAmount) || input.vatAmount < 0 || input.vatAmount >= input.amount) {
    throw new ValidationError("vatAmount", "VAT must be less than the total.");
  }
  return description;
}

/** A bill can only be booked to an active expense or equipment account. */
export async function assertBillAccount(accountCode: string, ledger: ILedgerRepository): Promise<void> {
  const account = await ledger.getAccount(accountCode);
  if (!account?.isActive || !isExpenseTarget(account)) {
    throw new ValidationError("accountCode", "Choose an active expense, inventory or equipment account.");
  }
}

const expenseLabel = (expense: Pick<Expense, "number" | "description">) =>
  `EX-${expense.number} ${expense.description}`;

function audit(
  actor: ActivityActor,
  action: "expense.recorded" | "expense.paid" | "expense.voided" | "expense.receiptChanged",
  changes: (e: Expense) => ReturnType<typeof singleChange>,
) {
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
    const description = assertBillFigures(input);
    if (input.receiptUrl !== undefined) assertReceipt(input.receiptUrl);
    await assertBillAccount(input.accountCode, this.ledger);

    return this.expenses.create(
      {
        date: input.date,
        supplierId: input.supplierId,
        accountCode: input.accountCode,
        description,
        amount: input.amount,
        vatAmount: input.vatAmount,
        paidFrom: input.paidFrom,
        receiptUrl: input.receiptUrl,
        recurring: input.recurring,
        createdById: actor.id,
        createdByName: actor.name,
      },
      (expense) => [expenseEntry(expense, actor)],
      audit(actor, "expense.recorded", (expense) => singleChange("amount", null, expense.amount)),
    );
  }
}

export type PayExpenseInput = {
  source: PaymentSource;
  paidOn: string;
  /** Part of what's owed; omitted pays all of it. */
  amount?: number;
};

/**
 * Pay some or all of an owed expense from cash or the bank: clears that much of
 * accounts payable and books the money out. The expense stays owed until the last
 * of it is paid.
 */
export class PayExpense {
  constructor(private readonly expenses: IExpenseRepository) {}

  async execute(id: string, input: PayExpenseInput, actor: ActivityActor, now: Date = new Date()): Promise<Expense> {
    const { source, paidOn } = input;
    const expense = await this.expenses.getExpense(id);
    if (!expense) throw new NotFoundError("expense", id);
    if (expense.status !== "unpaid")
      throw new ConflictError("INVALID_TRANSITION", `This expense is already ${expense.status}.`);
    if (paidOn > cafeDayOf(now)) throw new ValidationError("paidOn", "That date is in the future.");
    if (paidOn < expense.date) throw new ValidationError("paidOn", "An expense can't be paid before it was incurred.");
    const owed = amountOwed(expense);
    const amount = input.amount ?? owed;
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new ValidationError("amount", "Enter the amount.");
    if (amount > owed) throw new ValidationError("amount", "paymentOverOwed");

    return this.expenses.pay(
      id,
      { amount, source, paidOn, expectedPaid: expense.paidAmount },
      (paid) => [expensePaymentEntry(paid, { amount, source, date: paidOn }, actor)],
      audit(actor, "expense.paid", (paid) => singleChange("paidAmount", expense.paidAmount, paid.paidAmount)),
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

/**
 * Attach a receipt to an expense already on the books, swap it, or take it off.
 * A delivery's bill can only get one this way: it's recorded by `ReceiveStock`,
 * from the stock screen. Nothing it posted changes. A replaced file stays on disk
 * and the activity log keeps its URL, so the record of what was attached survives.
 */
export class SetExpenseReceipt {
  constructor(private readonly expenses: IExpenseRepository) {}

  async execute(id: string, receiptUrl: string | undefined, actor: ActivityActor): Promise<Expense> {
    if (receiptUrl !== undefined) assertReceipt(receiptUrl);
    const expense = await this.expenses.getExpense(id);
    if (!expense) throw new NotFoundError("expense", id);
    if (expense.status === "void") throw new ConflictError("INVALID_TRANSITION", "This expense is void.");
    if (expense.receiptUrl === receiptUrl) return expense;

    return this.expenses.setReceipt(
      id,
      receiptUrl,
      audit(actor, "expense.receiptChanged", () => singleChange("receiptUrl", expense.receiptUrl, receiptUrl)),
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

function assertReceipt(receiptUrl: string): void {
  if (!isReceiptUrl(receiptUrl)) throw new ValidationError("receiptUrl", "imageInvalid");
}

function clean(input: NewSupplier): NewSupplier {
  const name = input.name.trim();
  if (!name) throw new ValidationError("name", "Enter the supplier's name.");
  return { name, phone: input.phone?.trim() || undefined, note: input.note?.trim() || undefined };
}
