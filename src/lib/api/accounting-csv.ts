import { hasLocale } from "next-intl";

import type en from "@/messages/en.json";
import type {
  AccountBalance,
  BalanceSheet,
  MarginReport,
  ProfitAndLoss,
  StatementSection,
  TrialBalance,
  VatReport,
} from "@/src/domain/entities/AccountingReports";
import { jalaliDayLabel } from "@/src/domain/entities/JalaliCalendar";
import type { Account, JournalEntry } from "@/src/domain/entities/Ledger";
import { routing, type Locale } from "@/src/i18n/routing";

import { CSV_BOM, csvLine, type CsvCell } from "../csv";

/**
 * The statements and the journal as spreadsheet rows, in the reader's language:
 * laid out the way each reads on screen, with amounts as plain whole Toman.
 */
export type AccountingMessages = (typeof en)["dashAccounting"];

type Row = readonly CsvCell[];

/** The file's language; a link from the dashboard names it, and anything else gets the default. */
export function parseCsvLocale(params: URLSearchParams): Locale {
  const locale = params.get("locale");
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

/** Every label used here is plain text, so the catalog is read without a translator. */
export async function accountingMessages(locale: Locale): Promise<AccountingMessages> {
  const catalog = (await import(`../../../messages/${locale}.json`)) as {
    default: { dashAccounting: AccountingMessages };
  };
  return catalog.default.dashAccounting;
}

const accountName = (account: Pick<Account, "name" | "nameFa">, locale: Locale): string =>
  locale === "fa" ? account.nameFa : account.name;

/** A statement's dates on the calendar its reader keeps the books in. */
const dayLabel = (day: string, locale: Locale): string => (locale === "fa" ? jalaliDayLabel(day) : day);

function header(
  title: string,
  span: { fromDay: string; toDay: string } | { asOfDay: string },
  messages: AccountingMessages,
  locale: Locale,
): Row[] {
  const dates =
    "asOfDay" in span
      ? [messages.period.asOf, dayLabel(span.asOfDay, locale)]
      : [messages.period.periodLabel, dayLabel(span.fromDay, locale), dayLabel(span.toDay, locale)];
  return [[title], dates, []];
}

const accountRow = (row: AccountBalance, locale: Locale): Row => [
  row.account.code,
  accountName(row.account, locale),
  row.balance,
];

function sectionRows(heading: string, section: StatementSection, totalLabel: string, locale: Locale): Row[] {
  return [
    [undefined, heading],
    ...section.rows.map((row) => accountRow(row, locale)),
    [undefined, totalLabel, section.total],
    [],
  ];
}

export function profitAndLossRows(report: ProfitAndLoss, messages: AccountingMessages, locale: Locale): Row[] {
  const { pl } = messages;
  return [
    ...header(messages.statements["profit-and-loss"].title, report, messages, locale),
    [messages.export.code, messages.entry.colAccount, messages.export.amount],
    ...sectionRows(pl.revenue, report.revenue, pl.totalRevenue, locale),
    ...sectionRows(pl.costOfSales, report.costOfSales, pl.totalCostOfSales, locale),
    [undefined, pl.grossProfit, report.grossProfit],
    [],
    ...sectionRows(pl.expenses, report.expenses, pl.totalExpenses, locale),
    [undefined, report.netProfit < 0 ? pl.netLoss : pl.netProfit, report.netProfit],
  ];
}

export function balanceSheetRows(report: BalanceSheet, messages: AccountingMessages, locale: Locale): Row[] {
  const { bs, accountType } = messages;
  return [
    ...header(messages.statements["balance-sheet"].title, report, messages, locale),
    [messages.export.code, messages.entry.colAccount, messages.export.amount],
    ...sectionRows(accountType.asset, report.assets, bs.totalAssets, locale),
    ...sectionRows(accountType.liability, report.liabilities, bs.totalLiabilities, locale),
    [undefined, accountType.equity],
    ...report.equity.rows.map((row) => accountRow(row, locale)),
    [undefined, bs.currentEarnings, report.currentEarnings],
    [undefined, bs.totalEquity, report.totalEquity],
  ];
}

/** Each account netted to one side, as a trial balance is read. */
export function trialBalanceRows(report: TrialBalance, messages: AccountingMessages, locale: Locale): Row[] {
  const { entry } = messages;
  return [
    ...header(messages.statements["trial-balance"].title, report, messages, locale),
    [messages.export.code, entry.colAccount, entry.colDebit, entry.colCredit],
    ...report.rows.map((row): Row => {
      const net = row.debit - row.credit;
      return [
        row.account.code,
        accountName(row.account, locale),
        net > 0 ? net : undefined,
        net < 0 ? -net : undefined,
      ];
    }),
    [undefined, entry.totals, report.totalDebit, report.totalCredit],
  ];
}

export function vatRows(report: VatReport, messages: AccountingMessages, locale: Locale): Row[] {
  const { vat } = messages;
  return [
    ...header(messages.statements.vat.title, report, messages, locale),
    [messages.export.item, messages.export.amount],
    [vat.output, report.outputVat],
    [vat.input, -report.inputVat],
    [vat.net, report.netForPeriod],
    [vat.settled, report.settled],
    [vat.closing, report.closingBalance],
  ];
}

export function marginRows(report: MarginReport, messages: AccountingMessages, locale: Locale): Row[] {
  const { margins } = messages;
  return [
    ...header(messages.statements.margins.title, report, messages, locale),
    [
      margins.colItem,
      margins.colQuantity,
      margins.netRevenue,
      margins.cost,
      margins.grossProfit,
      `${margins.marginRate} (%)`,
    ],
    ...report.rows.map((row): Row => [
      row.name,
      row.quantity,
      row.netRevenue,
      row.marginRate === null ? undefined : row.cost,
      row.marginRate === null ? undefined : row.grossProfit,
      row.marginRate === null ? margins.noCost : Math.round(row.marginRate * 1000) / 10,
    ]),
    [messages.entry.totals, undefined, report.totalNetRevenue, report.totalCost, report.totalGrossProfit],
  ];
}

function journalEntryRows(
  entry: JournalEntry,
  accounts: ReadonlyMap<string, Account>,
  messages: AccountingMessages,
  locale: Locale,
): Row[] {
  return entry.lines.map((line) => {
    const account = accounts.get(line.accountCode);
    return [
      `JE-${entry.number}`,
      entry.date,
      jalaliDayLabel(entry.date),
      messages.source[entry.source],
      entry.description,
      line.accountCode,
      account ? accountName(account, locale) : undefined,
      line.debit || undefined,
      line.credit || undefined,
      line.memo,
      entry.createdByName,
      entry.reversedById ? messages.journal.reversed : undefined,
    ];
  });
}

/**
 * The journal, one row per line, read a batch at a time. Both dates are there: the
 * first sorts in any spreadsheet, the second is the calendar the books are closed on.
 */
export async function* journalCsv(
  batches: AsyncIterable<JournalEntry[]>,
  accounts: readonly Account[],
  messages: AccountingMessages,
  locale: Locale,
): AsyncGenerator<string> {
  const { entry, export: labels, journal } = messages;
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  yield CSV_BOM +
    csvLine([
      journal.colEntry,
      journal.colDate,
      labels.persianDate,
      journal.colSource,
      journal.colDescription,
      labels.code,
      entry.colAccount,
      entry.colDebit,
      entry.colCredit,
      entry.colMemo,
      labels.recordedBy,
      labels.status,
    ]);
  for await (const batch of batches) {
    yield batch.flatMap((row) => journalEntryRows(row, byCode, messages, locale).map(csvLine)).join("");
  }
}
