import { diffFields, singleChange, type ActivityActor, type NewActivityEntry } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { dueMonths, isDuePeriod, MAX_BILL_DAY, type DueBill, type RecurringBill } from "../../entities/RecurringBill";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { assertBillAccount, assertBillFigures, RecordExpense, type RecordExpenseInput } from "./ExpenseCommands";

import type { Expense } from "../../entities/Expense";
import type { IExpenseRepository } from "../../repositories/IExpenseRepository";
import type { ILedgerRepository } from "../../repositories/ILedgerRepository";
import type { IRecurringBillRepository, RecurringBillChanges } from "../../repositories/IRecurringBillRepository";

export type RecurringBillInput = Omit<RecurringBillChanges, "isActive">;

function auditEntry(
  actor: ActivityActor,
  action: "expense.recurringChanged" | "expense.recurringSkipped",
  bill: RecurringBill,
  changes: NewActivityEntry["changes"],
): NewActivityEntry {
  return {
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType: "expense",
    entityId: bill.id,
    entityLabel: bill.description,
    changes,
  };
}

async function checked(input: RecurringBillInput, ledger: ILedgerRepository): Promise<RecurringBillInput> {
  const description = assertBillFigures(input);
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > MAX_BILL_DAY) {
    throw new ValidationError("dayOfMonth", "billDayInvalid");
  }
  await assertBillAccount(input.accountCode, ledger);
  return { ...input, description };
}

/** Add a recurring bill, or edit one. Bills are switched off rather than deleted, so their months stay on record. */
export class SaveRecurringBill {
  constructor(
    private readonly bills: IRecurringBillRepository,
    private readonly ledger: ILedgerRepository,
  ) {}

  async create(input: RecurringBillInput, actor: ActivityActor, now: Date = new Date()): Promise<RecurringBill> {
    const valid = await checked(input, this.ledger);
    return this.bills.create({ ...valid, startsOn: cafeDayOf(now) }, (bill) =>
      auditEntry(actor, "expense.recurringChanged", bill, singleChange("amount", null, bill.amount)),
    );
  }

  async update(id: string, input: RecurringBillChanges, actor: ActivityActor): Promise<RecurringBill> {
    const valid = await checked(input, this.ledger);
    const before = await this.bills.get(id);
    if (!before) throw new NotFoundError("recurringBill", id);
    return this.bills.update(id, { ...valid, isActive: input.isActive }, (bill) => {
      const changes = diffFields(fields(before), fields(bill));
      return changes.length > 0 ? auditEntry(actor, "expense.recurringChanged", bill, changes) : null;
    });
  }
}

const fields = (bill: RecurringBill): Record<string, unknown> => ({
  description: bill.description,
  accountCode: bill.accountCode,
  supplierId: bill.supplierId,
  amount: bill.amount,
  vatAmount: bill.vatAmount,
  dayOfMonth: bill.dayOfMonth,
  isActive: bill.isActive,
});

/** What's waiting for someone across every bill, oldest first. */
export class ListDueBills {
  constructor(private readonly bills: IRecurringBillRepository) {}

  async execute(now: Date = new Date()): Promise<DueBill[]> {
    const today = cafeDayOf(now);
    const running = await this.bills.listActiveWithDone();
    return running
      .flatMap(({ bill, done }) => dueMonths(bill, new Set(done), today))
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.bill.description.localeCompare(b.bill.description));
  }
}

async function billOwing(
  bills: IRecurringBillRepository,
  id: string,
  period: string,
  now: Date,
): Promise<RecurringBill> {
  const bill = await bills.get(id);
  if (!bill) throw new NotFoundError("recurringBill", id);
  if (!bill.isActive) throw new ConflictError("INVALID_TRANSITION", "This bill is switched off.");
  if (!isDuePeriod(bill, period, cafeDayOf(now))) throw new ValidationError("period", "billNotDue");
  return bill;
}

/**
 * A person records a month of a bill, with the figures as they really came. It goes
 * through `RecordExpense`, so it's an ordinary expense with an ordinary entry; the
 * month is claimed in the same transaction, so it can't be booked twice.
 */
export class RecordRecurringBill {
  constructor(
    private readonly bills: IRecurringBillRepository,
    private readonly expenses: IExpenseRepository,
    private readonly ledger: ILedgerRepository,
  ) {}

  async execute(
    id: string,
    period: string,
    input: RecordExpenseInput,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<Expense> {
    await billOwing(this.bills, id, period, now);
    return new RecordExpense(this.expenses, this.ledger).execute(
      { ...input, recurring: { billId: id, period } },
      actor,
      now,
    );
  }
}

/** A month the bill doesn't apply: it stops being asked about, and nothing is booked. */
export class SkipRecurringBill {
  constructor(private readonly bills: IRecurringBillRepository) {}

  async execute(id: string, period: string, actor: ActivityActor, now: Date = new Date()): Promise<void> {
    const bill = await billOwing(this.bills, id, period, now);
    await this.bills.skip(bill, period, actor, (skipped) =>
      auditEntry(actor, "expense.recurringSkipped", skipped, singleChange("period", null, period)),
    );
  }
}
