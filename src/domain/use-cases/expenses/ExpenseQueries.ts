import { buildSupplierBalances, type ExpenseSummary, type SupplierBalances } from "../../entities/Expense";
import { jalaliMonthDays, jalaliToday } from "../../entities/JalaliCalendar";

import type { IExpenseRepository } from "../../repositories/IExpenseRepository";

/**
 * The Expenses page's figures: what's owed to suppliers now, what was recorded in
 * the current Persian month — the cafe's accounting month — and how many expenses
 * sit in each status.
 */
export class GetExpenseSummary {
  constructor(private readonly expenses: IExpenseRepository) {}

  execute(now: Date = new Date()): Promise<ExpenseSummary> {
    const today = jalaliToday(now);
    return this.expenses.summary(jalaliMonthDays(today.jy, today.jm));
  }
}

/**
 * The Suppliers page's balances. Read from the unpaid bills each time, like the
 * Expenses page's "owed", so there's no running total to drift from the books.
 */
export class GetSupplierBalances {
  constructor(private readonly expenses: IExpenseRepository) {}

  async execute(): Promise<SupplierBalances> {
    return buildSupplierBalances(await this.expenses.owedBySupplier());
  }
}
