import {
  allocate,
  SYSTEM_ACCOUNTS,
  vatIncluded,
  type JournalEntry,
  type JournalLine,
  type NewJournalEntry,
} from "./Ledger";
import { payRunTotals } from "./Payroll";

import type { BookLoan, BookLoanStatus } from "./BookLoan";
import type { CashShift } from "./CashShift";
import type { Expense, PaymentSource } from "./Expense";
import type { Income } from "./Income";
import type { Order, PaymentMethod, PaymentPart } from "./Order";
import type { OrderRefund } from "./OrderRefund";
import type { PayRun } from "./Payroll";
import type { ProductKind } from "./Product";

/**
 * The posting rules: how each money event becomes a balanced journal entry.
 * Pure functions — no I/O — so every rule is unit-tested, and the repositories
 * only decide *when* to post, never *what*.
 *
 * The flow for an order:
 *   completed → sale: Dr Guest receivables (total) / Cr Sales by kind (net) + Cr VAT payable
 *             → cost:  Dr Cost of sales / Cr Inventory (only for items with a cost)
 *   paid      → Dr Cash | Bank | Gateway clearing, one line per account / Cr Guest receivables
 *   unpaid (correcting a mistaken "paid") → the payment, reversed
 *   cancelled after being paid → refund: Dr Guest receivables / Cr the accounts it was paid into
 *   refunded after completion → return: Dr Sales by kind (net) + Dr VAT payable / Cr the method's account
 *                             → cost back, for units restocked: Dr Inventory / Cr Cost of sales
 *   written off (served, never paid) → the sale undone: Dr Sales by kind (net) + Dr VAT payable /
 *                             Cr Guest receivables; the cost of sales stays — the goods are gone
 *
 * A guest who pays before their order is completed leaves a credit on Guest
 * receivables until the sale is booked — exactly what a prepayment is.
 */

type Actor = { id: string; name: string };

const SALES_ACCOUNT: Record<ProductKind, string> = {
  drink: SYSTEM_ACCOUNTS.salesDrinks,
  food: SYSTEM_ACCOUNTS.salesFood,
  book: SYSTEM_ACCOUNTS.salesBooks,
};

/** The account a payment method's money lands in. */
export const PAYMENT_ACCOUNT: Record<PaymentMethod, string> = {
  cash: SYSTEM_ACCOUNTS.cash,
  card: SYSTEM_ACCOUNTS.bank,
  transfer: SYSTEM_ACCOUNTS.bank,
  online: SYSTEM_ACCOUNTS.gatewayClearing,
};

const SOURCE_ACCOUNT: Record<PaymentSource, string> = {
  cash: SYSTEM_ACCOUNTS.cash,
  bank: SYSTEM_ACCOUNTS.bank,
};

const label = (order: Pick<Order, "orderNumber">) => `Order #${order.orderNumber}`;

/** One line per account: card and transfer both land in the bank. */
function moneyLines(parts: readonly PaymentPart[], side: "debit" | "credit"): JournalLine[] {
  const byAccount = new Map<string, number>();
  for (const part of parts) {
    const account = PAYMENT_ACCOUNT[part.method];
    byAccount.set(account, (byAccount.get(account) ?? 0) + part.amount);
  }
  return [...byAccount].map(([accountCode, amount]) => ({
    accountCode,
    debit: side === "debit" ? amount : 0,
    credit: side === "credit" ? amount : 0,
  }));
}

const methodsLabel = (parts: readonly PaymentPart[]) => parts.map((part) => part.method).join(" + ");

/**
 * Revenue for a completed order. Prices are VAT-inclusive, so the VAT inside the
 * taxable lines goes to VAT payable — exempt lines (books) carry none — and the
 * rest is revenue by kind. Everything is allocated in whole Toman (the total over
 * the lines, then the VAT over the taxable ones), so the lines add up exactly.
 */
export function saleEntry(order: Order, vatRateBps: number, date: string, actor: Actor): NewJournalEntry {
  const lineTotals = allocate(
    order.total,
    order.items.map((item) => item.unitPrice * item.quantity),
  );
  const taxable = order.items.map((item, index) => (item.taxExempt ? 0 : lineTotals[index]));
  const vat = vatIncluded(
    taxable.reduce((sum, amount) => sum + amount, 0),
    vatRateBps,
  );
  const lineVat = allocate(vat, taxable);

  const netByKind = new Map<ProductKind, number>();
  order.items.forEach((item, index) => {
    netByKind.set(item.kind, (netByKind.get(item.kind) ?? 0) + lineTotals[index] - lineVat[index]);
  });
  const kinds = [...netByKind.keys()];

  return {
    date,
    description: `${label(order)} — sale`,
    source: "orderSale",
    sourceId: order.id,
    uniqueKey: `order:${order.id}:sale`,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.guestReceivables, debit: order.total, credit: 0 },
      ...kinds.map((kind) => ({ accountCode: SALES_ACCOUNT[kind], debit: 0, credit: netByKind.get(kind) ?? 0 })),
      { accountCode: SYSTEM_ACCOUNTS.vatPayable, debit: 0, credit: vat },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** What a completed order's items cost the cafe, from the costs snapshotted at placement; 0 when none are known. */
export function orderCost(order: Pick<Order, "items">): number {
  return order.items.reduce((sum, item) => sum + (item.stockTracked ? (item.unitCost ?? 0) * item.quantity : 0), 0);
}

/**
 * Cost of sales for a completed order: the stock its recipes consumed, at average
 * cost — exactly the value that left Inventory. `null` when nothing was consumed.
 */
export function costOfSalesEntry(order: Order, date: string, actor: Actor): NewJournalEntry | null {
  const cost = orderCost(order);
  if (cost <= 0) return null;
  return {
    date,
    description: `${label(order)} — cost of sales`,
    source: "orderCost",
    sourceId: order.id,
    uniqueKey: `order:${order.id}:cost`,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.costOfSales, debit: cost, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.inventory, debit: 0, credit: cost },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** The guest paid: money into each part's account, receivable cleared. */
export function paymentEntry(order: Order, parts: readonly PaymentPart[], date: string, actor: Actor): NewJournalEntry {
  return {
    date,
    description: `${label(order)} — payment (${methodsLabel(parts)})`,
    source: "orderPayment",
    sourceId: order.id,
    lines: [
      ...moneyLines(parts, "debit"),
      { accountCode: SYSTEM_ACCOUNTS.guestReceivables, debit: 0, credit: order.total },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * Money going back the way it came: for a "paid" mark that was a mistake
 * (`orderPaymentReversal`) or a paid order that was cancelled (`orderRefund`).
 */
export function paymentReturnEntry(
  order: Order,
  parts: readonly PaymentPart[],
  kind: "orderPaymentReversal" | "orderRefund",
  date: string,
  actor: Actor,
): NewJournalEntry {
  return {
    date,
    description: `${label(order)} — ${kind === "orderRefund" ? "refund" : "payment unmarked"} (${methodsLabel(parts)})`,
    source: kind,
    sourceId: order.id,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.guestReceivables, debit: order.total, credit: 0 },
      ...moneyLines(parts, "credit"),
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * Money back on a completed order. The sale stands, so this takes the refunded
 * units out of revenue and output VAT directly rather than through receivables:
 * the guest's receivable was settled when they paid.
 */
export function orderReturnEntry(
  order: Pick<Order, "orderNumber">,
  refund: OrderRefund,
  actor: Actor,
): NewJournalEntry {
  const netByKind = new Map<ProductKind, number>();
  for (const line of refund.lines) {
    netByKind.set(line.kind, (netByKind.get(line.kind) ?? 0) + line.amount - line.vatAmount);
  }
  return {
    date: refund.date,
    description: `${label(order)} — refund R-${refund.number} (${refund.method})`,
    source: "orderReturn",
    sourceId: refund.orderId,
    uniqueKey: `orderRefund:${refund.id}`,
    lines: [
      ...[...netByKind].map(([kind, amount]) => ({ accountCode: SALES_ACCOUNT[kind], debit: amount, credit: 0 })),
      { accountCode: SYSTEM_ACCOUNTS.vatPayable, debit: refund.vatAmount, credit: 0 },
      { accountCode: PAYMENT_ACCOUNT[refund.method], debit: 0, credit: refund.amount },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** Units back on the shelf take their cost back out of cost of sales. `null` when none carried a cost. */
export function orderReturnCostEntry(
  order: Pick<Order, "orderNumber">,
  refund: OrderRefund,
  value: number,
  actor: Actor,
): NewJournalEntry | null {
  if (value <= 0) return null;
  return {
    date: refund.date,
    description: `${label(order)} — refund R-${refund.number}, back in stock`,
    source: "orderReturnCost",
    sourceId: refund.orderId,
    uniqueKey: `orderRefund:${refund.id}:cost`,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.inventory, debit: value, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.costOfSales, debit: 0, credit: value },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * A served order nobody paid for, written off: its sale comes back out of revenue
 * and output VAT, against the receivable the sale left — the money that will never
 * come. Built from the sale as it was booked (each account's line, sides swapped),
 * not re-priced, so a VAT rate changed since leaves nothing behind. The cost of
 * sales isn't touched: the goods were consumed.
 */
export function orderWriteOffEntry(
  order: Pick<Order, "id" | "orderNumber">,
  sale: Pick<JournalEntry, "lines">,
  date: string,
  reason: string | undefined,
  actor: Actor,
): NewJournalEntry {
  return {
    date,
    description: reason ? `${label(order)} — written off: ${reason}` : `${label(order)} — written off`,
    source: "orderWriteOff",
    sourceId: order.id,
    uniqueKey: `order:${order.id}:writeOff`,
    lines: sale.lines.map((line) => ({ accountCode: line.accountCode, debit: line.credit, credit: line.debit })),
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** Money in outside an order: Dr the method's account / Cr the revenue account (net) + Cr VAT payable. */
export function incomeEntry(income: Income, actor: Actor): NewJournalEntry {
  return {
    date: income.date,
    description: `IN-${income.number} — ${income.description}`,
    source: "income",
    sourceId: income.id,
    uniqueKey: `income:${income.id}`,
    lines: [
      { accountCode: PAYMENT_ACCOUNT[income.method], debit: income.amount, credit: 0, memo: income.payerName },
      { accountCode: income.accountCode, debit: 0, credit: income.amount - income.vatAmount },
      { accountCode: SYSTEM_ACCOUNTS.vatPayable, debit: 0, credit: income.vatAmount },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** A deposit left against a borrowed book: the cafe holds it, so it's a liability, not income. */
export function loanDepositEntry(loan: BookLoan, date: string, actor: Actor): NewJournalEntry | null {
  if (loan.depositAmount <= 0 || !loan.depositMethod) return null;
  return {
    date,
    description: `L-${loan.reference} — deposit taken`,
    source: "loanDeposit",
    sourceId: loan.id,
    uniqueKey: `loan:${loan.id}:deposit`,
    lines: [
      { accountCode: SOURCE_ACCOUNT[loan.depositMethod], debit: loan.depositAmount, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.depositsHeld, debit: 0, credit: loan.depositAmount, memo: loan.borrowerName },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * What a loan closing does to its deposit: a book that came back gets it handed
 * back, a lost one keeps it as income, and a lost book that turns up later gets
 * that income handed back. `null` without a deposit, or for any other move.
 */
export function loanDepositSettledEntry(
  loan: BookLoan,
  from: BookLoanStatus,
  date: string,
  actor: Actor,
): NewJournalEntry | null {
  if (loan.depositAmount <= 0 || !loan.depositMethod) return null;
  const money = SOURCE_ACCOUNT[loan.depositMethod];
  const moved = (description: string, key: string, debitCode: string, creditCode: string): NewJournalEntry => ({
    date,
    description: `L-${loan.reference} — ${description}`,
    source: "loanDeposit",
    sourceId: loan.id,
    uniqueKey: `loan:${loan.id}:${key}`,
    lines: [
      { accountCode: debitCode, debit: loan.depositAmount, credit: 0, memo: loan.borrowerName },
      { accountCode: creditCode, debit: 0, credit: loan.depositAmount },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  });

  if (loan.status === "lost" && from === "out") {
    return moved("deposit kept", "depositKept", SYSTEM_ACCOUNTS.depositsHeld, SYSTEM_ACCOUNTS.otherIncome);
  }
  if (loan.status === "returned" && from === "out") {
    return moved("deposit returned", "depositReturned", SYSTEM_ACCOUNTS.depositsHeld, money);
  }
  if (loan.status === "returned" && from === "lost") {
    return moved("deposit returned", "depositRepaid", SYSTEM_ACCOUNTS.otherIncome, money);
  }
  return null;
}

/**
 * An expense as incurred: the cost (net of reclaimable VAT) to its account, the
 * VAT against VAT payable, and the total either out of cash/bank (paid now) or owed
 * to the supplier (accounts payable).
 */
export function expenseEntry(expense: Expense, actor: Actor): NewJournalEntry {
  const credit =
    expense.status === "paid" && expense.paidFrom ? SOURCE_ACCOUNT[expense.paidFrom] : SYSTEM_ACCOUNTS.accountsPayable;
  return {
    date: expense.date,
    description: `EX-${expense.number} — ${expense.description}`,
    source: "expense",
    sourceId: expense.id,
    uniqueKey: `expense:${expense.id}`,
    lines: [
      {
        accountCode: expense.accountCode,
        debit: expense.amount - expense.vatAmount,
        credit: 0,
        memo: expense.supplierName,
      },
      { accountCode: SYSTEM_ACCOUNTS.vatPayable, debit: expense.vatAmount, credit: 0 },
      { accountCode: credit, debit: 0, credit: expense.amount },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * Paying a supplier some or all of what's owed on an expense. `expense` is as it
 * stands after the payment: its paid total only ever grows, so it keys each payment
 * and a repeated request can't book the same one twice.
 */
export function expensePaymentEntry(
  expense: Expense,
  payment: { amount: number; source: PaymentSource; date: string },
  actor: Actor,
): NewJournalEntry {
  return {
    date: payment.date,
    description: `EX-${expense.number} — paid from ${payment.source}`,
    source: "expensePayment",
    sourceId: expense.id,
    uniqueKey: `expense:${expense.id}:payment:${expense.paidAmount}`,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.accountsPayable, debit: payment.amount, credit: 0, memo: expense.supplierName },
      { accountCode: SOURCE_ACCOUNT[payment.source], debit: 0, credit: payment.amount },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * A shift's drawer didn't match the books: an overage is cash the books didn't
 * know about (Dr Cash / Cr Cash over and short), a shortage is cash that's gone
 * (Dr Cash over and short / Cr Cash). `null` when the count was exact.
 */
export function cashOverShortEntry(shift: CashShift, date: string, actor: Actor): NewJournalEntry | null {
  const difference = shift.difference ?? 0;
  if (difference === 0) return null;
  const amount = Math.abs(difference);
  const over = difference > 0;
  return {
    date,
    description: `Shift Z-${shift.number} — cash ${over ? "over" : "short"}`,
    source: "cashShift",
    sourceId: shift.id,
    uniqueKey: `cashShift:${shift.id}`,
    lines: [
      { accountCode: over ? SYSTEM_ACCOUNTS.cash : SYSTEM_ACCOUNTS.cashOverShort, debit: amount, credit: 0 },
      { accountCode: over ? SYSTEM_ACCOUNTS.cashOverShort : SYSTEM_ACCOUNTS.cash, debit: 0, credit: amount },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * A month's payroll. Salaries and the employer's share of insurance are the month's
 * cost; what's owed goes to the staff (their net), the insurance office (both shares)
 * and the tax office. Totals only: who earned what stays on the pay run, so reading
 * the journal doesn't show anyone's pay.
 */
export function payrollEntry(run: PayRun, actor: Actor): NewJournalEntry {
  const totals = payRunTotals(run.lines);
  return {
    date: run.date,
    description: `Payroll ${run.period}`,
    source: "payroll",
    sourceId: run.id,
    uniqueKey: `payroll:${run.id}`,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.salaries, debit: totals.gross, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.employerInsurance, debit: totals.employerInsurance, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.salariesPayable, debit: 0, credit: totals.net },
      {
        accountCode: SYSTEM_ACCOUNTS.insurancePayable,
        debit: 0,
        credit: totals.employeeInsurance + totals.employerInsurance,
      },
      { accountCode: SYSTEM_ACCOUNTS.payrollTaxPayable, debit: 0, credit: totals.incomeTax },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** Salaries paid out, some or all of a run: Dr Salaries payable / Cr the cash or the bank. */
export function payrollPaymentEntry(
  run: PayRun,
  payment: { amount: number; source: PaymentSource; date: string },
  actor: Actor,
): NewJournalEntry {
  return {
    date: payment.date,
    description: `Payroll ${run.period} payment`,
    source: "payrollPayment",
    sourceId: run.id,
    // Keyed on what's been paid after this, so each part of a run gets its own entry.
    uniqueKey: `payroll:${run.id}:payment:${run.paidAmount}`,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.salariesPayable, debit: payment.amount, credit: 0 },
      { accountCode: SOURCE_ACCOUNT[payment.source], debit: 0, credit: payment.amount },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** A gateway payout as the bank statement shows it: what was deposited and the fee kept back. */
export type GatewaySettlement = {
  date: string;
  /** Whole Toman that arrived in the bank. */
  deposited: number;
  /** Whole Toman the gateway kept as its fee (0 when none). */
  fee: number;
  /** The payout's reference, e.g. the settlement or transfer number. */
  reference?: string;
};

/** What a payout takes off the gateway clearing account: the deposit plus the fee. */
export function settledAmount(settlement: Pick<GatewaySettlement, "deposited" | "fee">): number {
  return settlement.deposited + settlement.fee;
}

/**
 * The gateway paid out: Dr Bank (deposited) + Dr Bank & gateway fees (fee) /
 * Cr Gateway clearing (both). A mistaken payout is reversed from the journal.
 */
export function gatewaySettlementEntry(settlement: GatewaySettlement, actor: Actor): NewJournalEntry {
  const reference = settlement.reference?.trim() || undefined;
  return {
    date: settlement.date,
    description: reference ? `Gateway payout ${reference}` : "Gateway payout",
    source: "gatewaySettlement",
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.bank, debit: settlement.deposited, credit: 0, memo: reference },
      { accountCode: SYSTEM_ACCOUNTS.gatewayFees, debit: settlement.fee, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.gatewayClearing, debit: 0, credit: settledAmount(settlement) },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * Closing a fiscal year: every revenue and expense account's balance for the year
 * is brought to zero against retained earnings (3200), so the next year's profit
 * and loss starts from nothing and the year's result sits in equity.
 * `movements` are the year's net debits − credits per revenue/expense account.
 */
export function yearCloseEntry(
  input: { fiscalYear: number; toDay: string; movements: readonly { accountCode: string; net: number }[] },
  actor: Actor,
): NewJournalEntry | null {
  const lines = input.movements
    .filter((row) => row.net !== 0)
    .map((row) =>
      row.net > 0
        ? { accountCode: row.accountCode, debit: 0, credit: row.net }
        : { accountCode: row.accountCode, debit: -row.net, credit: 0 },
    );
  if (lines.length === 0) return null;
  // Credits beat debits for a profit: the plug credits retained earnings.
  const result = input.movements.reduce((sum, row) => sum + row.net, 0);
  if (result < 0) lines.push({ accountCode: SYSTEM_ACCOUNTS.retainedEarnings, debit: 0, credit: -result });
  if (result > 0) lines.push({ accountCode: SYSTEM_ACCOUNTS.retainedEarnings, debit: result, credit: 0 });
  return {
    date: input.toDay,
    description: `Close fiscal year ${input.fiscalYear}`,
    source: "yearClose",
    uniqueKey: `yearClose:${input.fiscalYear}`,
    lines,
    createdById: actor.id,
    createdByName: actor.name,
  };
}
