import { allocate, SYSTEM_ACCOUNTS, vatIncluded, type NewJournalEntry } from "./Ledger";

import type { Expense, PaymentSource } from "./Expense";
import type { Order, PaymentMethod } from "./Order";
import type { ProductKind } from "./Product";

/**
 * The posting rules: how each money event becomes a balanced journal entry.
 * Pure functions — no I/O — so every rule is unit-tested, and the repositories
 * only decide *when* to post, never *what*.
 *
 * The flow for an order:
 *   completed → sale: Dr Guest receivables (total) / Cr Sales by kind (net) + Cr VAT payable
 *             → cost:  Dr Cost of sales / Cr Inventory (only for items with a cost)
 *   paid      → Dr Cash | Bank | Gateway clearing / Cr Guest receivables
 *   unpaid (correcting a mistaken "paid") → the payment, reversed
 *   cancelled after being paid → refund: Dr Guest receivables / Cr the account it was paid into
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

/**
 * Revenue for a completed order. Prices are VAT-inclusive, so the VAT inside the
 * taxable lines goes to VAT payable — exempt lines (books) carry none — and the
 * rest is revenue by kind. Everything is allocated in whole Toman (the total over
 * the lines, then the VAT over the taxable ones), so the lines add up exactly.
 */
export function saleEntry(order: Order, vatRateBps: number, date: string, actor: Actor): NewJournalEntry {
  const lineTotals = allocate(order.total, order.items.map((item) => item.unitPrice * item.quantity));
  const taxable = order.items.map((item, index) => (item.taxExempt ? 0 : lineTotals[index]));
  const vat = vatIncluded(taxable.reduce((sum, amount) => sum + amount, 0), vatRateBps);
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

/** The guest paid: money into the method's account, receivable cleared. */
export function paymentEntry(order: Order, method: PaymentMethod, date: string, actor: Actor): NewJournalEntry {
  return {
    date,
    description: `${label(order)} — payment (${method})`,
    source: "orderPayment",
    sourceId: order.id,
    lines: [
      { accountCode: PAYMENT_ACCOUNT[method], debit: order.total, credit: 0 },
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
  method: PaymentMethod,
  kind: "orderPaymentReversal" | "orderRefund",
  date: string,
  actor: Actor,
): NewJournalEntry {
  return {
    date,
    description: `${label(order)} — ${kind === "orderRefund" ? "refund" : "payment unmarked"} (${method})`,
    source: kind,
    sourceId: order.id,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.guestReceivables, debit: order.total, credit: 0 },
      { accountCode: PAYMENT_ACCOUNT[method], debit: 0, credit: order.total },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * An expense as incurred: the cost (net of reclaimable VAT) to its account, the
 * VAT against VAT payable, and the total either out of cash/bank (paid now) or owed
 * to the supplier (accounts payable).
 */
export function expenseEntry(expense: Expense, actor: Actor): NewJournalEntry {
  const credit = expense.status === "paid" && expense.paidFrom ? SOURCE_ACCOUNT[expense.paidFrom] : SYSTEM_ACCOUNTS.accountsPayable;
  return {
    date: expense.date,
    description: `EX-${expense.number} — ${expense.description}`,
    source: "expense",
    sourceId: expense.id,
    uniqueKey: `expense:${expense.id}`,
    lines: [
      { accountCode: expense.accountCode, debit: expense.amount - expense.vatAmount, credit: 0, memo: expense.supplierName },
      { accountCode: SYSTEM_ACCOUNTS.vatPayable, debit: expense.vatAmount, credit: 0 },
      { accountCode: credit, debit: 0, credit: expense.amount },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** Paying a supplier for an expense that was owed. */
export function expensePaymentEntry(expense: Expense, source: PaymentSource, date: string, actor: Actor): NewJournalEntry {
  return {
    date,
    description: `EX-${expense.number} — paid from ${source}`,
    source: "expensePayment",
    sourceId: expense.id,
    uniqueKey: `expense:${expense.id}:payment`,
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.accountsPayable, debit: expense.amount, credit: 0, memo: expense.supplierName },
      { accountCode: SOURCE_ACCOUNT[source], debit: 0, credit: expense.amount },
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
export function yearCloseEntry(input: { fiscalYear: number; toDay: string; movements: readonly { accountCode: string; net: number }[] }, actor: Actor): NewJournalEntry | null {
  const lines = input.movements
    .filter((row) => row.net !== 0)
    .map((row) => (row.net > 0 ? { accountCode: row.accountCode, debit: 0, credit: row.net } : { accountCode: row.accountCode, debit: -row.net, credit: 0 }));
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
