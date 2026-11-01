import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import {
  isIncomeTarget,
  MAX_INCOME_DESCRIPTION_LENGTH,
  MAX_PAYER_NAME_LENGTH,
  type Income,
  type IncomeMethod,
  type IncomeSourceType,
  type IncomeSummary,
} from "../../entities/Income";
import { jalaliMonthDays, jalaliToday } from "../../entities/JalaliCalendar";
import { reversalOf } from "../../entities/Ledger";
import { incomeEntry } from "../../entities/Postings";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { IIncomeRepository } from "../../repositories/IIncomeRepository";
import type { ILedgerRepository } from "../../repositories/ILedgerRepository";

export type RecordIncomeInput = {
  date: string;
  accountCode: string;
  description: string;
  amount: number;
  vatAmount: number;
  method: IncomeMethod;
  payerName?: string;
  /** What it was paid for, when it was: an event sign-up or a suite stay. */
  sourceType?: IncomeSourceType;
  sourceId?: string;
};

const incomeLabel = (income: Pick<Income, "number" | "description">) => `IN-${income.number} ${income.description}`;

function audit(
  actor: ActivityActor,
  action: "income.recorded" | "income.voided",
  changes: (income: Income) => ReturnType<typeof singleChange>,
) {
  return (income: Income) => ({
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType: "income" as const,
    entityId: income.id,
    entityLabel: incomeLabel(income),
    changes: changes(income),
  });
}

/**
 * Record money that came in outside an order. The total goes into the cash register
 * or the bank, the VAT inside it to VAT payable and the rest to its revenue account,
 * all in the same transaction as the row. Prices are VAT-inclusive, as on the menu.
 */
export class RecordIncome {
  constructor(
    private readonly incomes: IIncomeRepository,
    private readonly ledger: Pick<ILedgerRepository, "getAccount">,
  ) {}

  async execute(input: RecordIncomeInput, actor: ActivityActor, now: Date = new Date()): Promise<Income> {
    if (input.date > cafeDayOf(now)) throw new ValidationError("date", "That date is in the future.");
    const description = input.description.trim();
    if (!description || description.length > MAX_INCOME_DESCRIPTION_LENGTH) {
      throw new ValidationError("description", "Describe the income (up to 300 characters).");
    }
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new ValidationError("amount", "Enter the amount.");
    }
    if (!Number.isSafeInteger(input.vatAmount) || input.vatAmount < 0 || input.vatAmount >= input.amount) {
      throw new ValidationError("vatAmount", "VAT must be less than the total.");
    }
    const payerName = input.payerName?.trim() || undefined;
    if (payerName && payerName.length > MAX_PAYER_NAME_LENGTH) {
      throw new ValidationError("payerName", "That name is too long.");
    }
    if (Boolean(input.sourceType) !== Boolean(input.sourceId)) {
      throw new ValidationError("sourceId", "Say what it was paid for.");
    }
    const account = await this.ledger.getAccount(input.accountCode);
    if (!account?.isActive || !isIncomeTarget(account)) {
      throw new ValidationError("accountCode", "Choose an active revenue account.");
    }

    return this.incomes.create(
      {
        date: input.date,
        accountCode: input.accountCode,
        description,
        amount: input.amount,
        vatAmount: input.vatAmount,
        method: input.method,
        payerName,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        createdById: actor.id,
        createdByName: actor.name,
      },
      (income) => [incomeEntry(income, actor)],
      audit(actor, "income.recorded", (income) => singleChange("amount", null, income.amount)),
    );
  }
}

/**
 * Void income entered by mistake, or hand it back: its entry is reversed today, so a
 * closed period stays closed and the history shows both.
 */
export class VoidIncome {
  constructor(private readonly incomes: IIncomeRepository) {}

  async execute(id: string, reason: string, actor: ActivityActor, now: Date = new Date()): Promise<Income> {
    const income = await this.incomes.getIncome(id);
    if (!income) throw new NotFoundError("income", id);
    if (income.status === "void") throw new ConflictError("INVALID_TRANSITION", "This income is already void.");
    const today = cafeDayOf(now);
    const why = reason.trim() || `IN-${income.number} voided`;

    return this.incomes.void(
      id,
      (entry) => reversalOf(entry, today, why, actor),
      audit(actor, "income.voided", () => singleChange("status", "received", "void")),
    );
  }
}

/** The Income page's figures: what came in this Persian month, and each status's count. */
export class GetIncomeSummary {
  constructor(private readonly incomes: IIncomeRepository) {}

  execute(now: Date = new Date()): Promise<IncomeSummary> {
    const today = jalaliToday(now);
    return this.incomes.summary(jalaliMonthDays(today.jy, today.jm));
  }
}
