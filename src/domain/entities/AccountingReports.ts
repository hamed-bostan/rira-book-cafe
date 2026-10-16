import { signedBalance, vatIncluded, type Account, type JournalSource } from "./Ledger";

/**
 * The financial statements, as plain data. Every amount is whole Toman. Each
 * statement carries its own check (debits = credits, assets = liabilities +
 * equity) so a screen can show the books are in balance rather than assume it.
 */

/** Raw movement on one account over a span: total debits and credits. */
export type AccountMovement = { accountCode: string; debit: number; credit: number };

/** An account with its movement and its balance on the normal side. */
export type AccountBalance = {
  account: Account;
  debit: number;
  credit: number;
  /** Positive in the account's usual direction (assets/expenses: debit; others: credit). */
  balance: number;
};

export type TrialBalance = {
  asOfDay: string;
  rows: AccountBalance[];
  totalDebit: number;
  totalCredit: number;
  /** Total debits equal total credits — true unless something is badly wrong. */
  balanced: boolean;
};

export type StatementSection = { rows: AccountBalance[]; total: number };

export type ProfitAndLoss = {
  fromDay: string;
  toDay: string;
  revenue: StatementSection;
  costOfSales: StatementSection;
  grossProfit: number;
  expenses: StatementSection;
  netProfit: number;
};

export type BalanceSheet = {
  asOfDay: string;
  assets: StatementSection;
  liabilities: StatementSection;
  equity: StatementSection;
  /** Profit not yet closed into retained earnings: all revenue − all expenses to date. */
  currentEarnings: number;
  /** Equity accounts plus current earnings. */
  totalEquity: number;
  /** Assets = liabilities + equity. */
  balanced: boolean;
};

/** VAT movement over a span, from VAT payable (2200). */
export type VatReport = {
  fromDay: string;
  toDay: string;
  /** VAT collected inside sales. */
  outputVat: number;
  /** VAT paid inside expenses, offset against output VAT. */
  inputVat: number;
  /** Paid to (or settled with) the tax office, via manual entries. */
  settled: number;
  /** Output − input: what the period adds to the VAT owed. */
  netForPeriod: number;
  /** VAT payable balance at the end of the span. */
  closingBalance: number;
};

export type LedgerLine = {
  entryId: string;
  number: number;
  date: string;
  description: string;
  source: JournalSource;
  debit: number;
  credit: number;
  memo?: string;
  /** Balance after this line, on the account's normal side. */
  runningBalance: number;
};

export type AccountLedger = {
  account: Account;
  fromDay: string;
  toDay: string;
  openingBalance: number;
  lines: LedgerLine[];
  closingBalance: number;
};

/** What one menu item earned over a span, net of VAT, against what it cost. */
export type ItemMargin = {
  productId: string;
  name: string;
  quantity: number;
  /** Sales excluding VAT. */
  netRevenue: number;
  /** Cost of what was sold; 0 when the item has no cost price. */
  cost: number;
  grossProfit: number;
  /** Gross profit / net revenue, 0–1; `null` without a cost (unknown margin). */
  marginRate: number | null;
};

export type MarginReport = {
  fromDay: string;
  toDay: string;
  rows: ItemMargin[];
  totalNetRevenue: number;
  totalCost: number;
  totalGrossProfit: number;
  /** Revenue from items with no cost price — their margin isn't known. */
  revenueWithoutCost: number;
};

// --- Builders. Pure: the use-cases fetch movements and hand them in.

/** Accounts with any movement, each with its normal-side balance, in code order. */
export function accountBalances(accounts: readonly Account[], movements: readonly AccountMovement[]): AccountBalance[] {
  const byCode = new Map(movements.map((movement) => [movement.accountCode, movement]));
  return accounts
    .filter((account) => {
      const movement = byCode.get(account.code);
      return movement !== undefined && (movement.debit !== 0 || movement.credit !== 0);
    })
    .map((account) => {
      const { debit, credit } = byCode.get(account.code) ?? { debit: 0, credit: 0 };
      return { account, debit, credit, balance: signedBalance(account.type, debit, credit) };
    })
    .sort((a, b) => a.account.code.localeCompare(b.account.code));
}

function section(rows: AccountBalance[]): StatementSection {
  return { rows, total: rows.reduce((sum, row) => sum + row.balance, 0) };
}

/** Cost of sales lives in the 5xxx range; every other expense account is operating cost. */
export function isCostOfSales(account: Pick<Account, "code" | "type">): boolean {
  return account.type === "expense" && account.code.startsWith("5");
}

export function buildTrialBalance(asOfDay: string, accounts: readonly Account[], movements: readonly AccountMovement[]): TrialBalance {
  const rows = accountBalances(accounts, movements);
  // Each account nets to one side, as a trial balance is read.
  const totalDebit = rows.reduce((sum, row) => sum + Math.max(row.debit - row.credit, 0), 0);
  const totalCredit = rows.reduce((sum, row) => sum + Math.max(row.credit - row.debit, 0), 0);
  return { asOfDay, rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

export function buildProfitAndLoss(
  fromDay: string,
  toDay: string,
  accounts: readonly Account[],
  movements: readonly AccountMovement[],
): ProfitAndLoss {
  const rows = accountBalances(accounts, movements);
  const revenue = section(rows.filter((row) => row.account.type === "revenue"));
  const costOfSales = section(rows.filter((row) => isCostOfSales(row.account)));
  const expenses = section(rows.filter((row) => row.account.type === "expense" && !isCostOfSales(row.account)));
  const grossProfit = revenue.total - costOfSales.total;
  return { fromDay, toDay, revenue, costOfSales, grossProfit, expenses, netProfit: grossProfit - expenses.total };
}

export function buildBalanceSheet(asOfDay: string, accounts: readonly Account[], movements: readonly AccountMovement[]): BalanceSheet {
  const rows = accountBalances(accounts, movements);
  const of = (type: Account["type"]) => section(rows.filter((row) => row.account.type === type));
  const assets = of("asset");
  const liabilities = of("liability");
  const equity = of("equity");
  const currentEarnings = of("revenue").total - of("expense").total;
  const totalEquity = equity.total + currentEarnings;
  return {
    asOfDay,
    assets,
    liabilities,
    equity,
    currentEarnings,
    totalEquity,
    balanced: assets.total === liabilities.total + totalEquity,
  };
}

export function buildAccountLedger(
  account: Account,
  fromDay: string,
  toDay: string,
  opening: AccountMovement | undefined,
  lines: readonly Omit<LedgerLine, "runningBalance">[],
): AccountLedger {
  const openingBalance = opening ? signedBalance(account.type, opening.debit, opening.credit) : 0;
  let running = openingBalance;
  const withBalance = lines.map((line) => {
    running += signedBalance(account.type, line.debit, line.credit);
    return { ...line, runningBalance: running };
  });
  return { account, fromDay, toDay, openingBalance, lines: withBalance, closingBalance: running };
}

/**
 * Item margins net of VAT. VAT is taken out of each item's taxable sales at the
 * current rate — exact unless the rate changed inside the span, in which case the
 * VAT report (built from the postings themselves) is the authority.
 */
export function buildMarginReport(
  fromDay: string,
  toDay: string,
  items: readonly { productId: string; name: string; quantity: number; gross: number; taxableGross: number; cost: number; costKnown: boolean }[],
  vatRateBps: number,
): MarginReport {
  const rows: ItemMargin[] = items.map((item) => {
    const netRevenue = item.gross - vatIncluded(item.taxableGross, vatRateBps);
    const cost = item.costKnown ? item.cost : 0;
    return {
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      netRevenue,
      cost,
      grossProfit: netRevenue - cost,
      marginRate: item.costKnown && netRevenue > 0 ? (netRevenue - cost) / netRevenue : null,
    };
  });
  const known = rows.filter((row) => row.marginRate !== null);
  return {
    fromDay,
    toDay,
    rows,
    totalNetRevenue: rows.reduce((sum, row) => sum + row.netRevenue, 0),
    totalCost: known.reduce((sum, row) => sum + row.cost, 0),
    totalGrossProfit: known.reduce((sum, row) => sum + row.grossProfit, 0),
    revenueWithoutCost: rows.filter((row) => row.marginRate === null).reduce((sum, row) => sum + row.netRevenue, 0),
  };
}
