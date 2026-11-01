import { describe, expect, it } from "vitest";

import {
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTrialBalance,
  type AccountMovement,
} from "@/src/domain/entities/AccountingReports";
import type { Account, JournalEntry } from "@/src/domain/entities/Ledger";

import {
  accountingMessages,
  balanceSheetRows,
  journalCsv,
  marginRows,
  parseCsvLocale,
  profitAndLossRows,
  trialBalanceRows,
  vatRows,
} from "../accounting-csv";

const account = (code: string, name: string, nameFa: string, type: Account["type"]): Account => ({
  code,
  name,
  nameFa,
  type,
  isSystem: false,
  isActive: true,
});

const ACCOUNTS = [
  account("1110", "Cash", "صندوق", "asset"),
  account("3100", "Owner capital", "سرمایه", "equity"),
  account("4100", "Drinks", "نوشیدنی", "revenue"),
  account("5100", "Cost of sales", "بهای تمام‌شده", "expense"),
  account("6100", "Rent", "اجاره", "expense"),
];

const MOVEMENTS: AccountMovement[] = [
  { accountCode: "1110", debit: 1_500_000, credit: 200_000 },
  { accountCode: "3100", debit: 0, credit: 500_000 },
  { accountCode: "4100", debit: 0, credit: 1_000_000 },
  { accountCode: "5100", debit: 100_000, credit: 0 },
  { accountCode: "6100", debit: 100_000, credit: 0 },
];

const en = await accountingMessages("en");
const fa = await accountingMessages("fa");

describe("parseCsvLocale", () => {
  it("takes a known locale and falls back to the default", () => {
    expect(parseCsvLocale(new URLSearchParams("locale=fa"))).toBe("fa");
    expect(parseCsvLocale(new URLSearchParams("locale=../../secrets"))).toBe("en");
    expect(parseCsvLocale(new URLSearchParams())).toBe("en");
  });
});

describe("statement rows", () => {
  const pl = buildProfitAndLoss("2026-09-23", "2026-10-22", ACCOUNTS, MOVEMENTS);

  it("lays out the profit and loss as it reads on screen", () => {
    expect(profitAndLossRows(pl, en, "en")).toEqual([
      ["Profit and loss"],
      ["Period", "2026-09-23", "2026-10-22"],
      [],
      ["Code", "Account", "Amount"],
      [undefined, "Revenue"],
      ["4100", "Drinks", 1_000_000],
      [undefined, "Total revenue", 1_000_000],
      [],
      [undefined, "Cost of sales"],
      ["5100", "Cost of sales", 100_000],
      [undefined, "Total cost of sales", 100_000],
      [],
      [undefined, "Gross profit", 900_000],
      [],
      [undefined, "Operating expenses"],
      ["6100", "Rent", 100_000],
      [undefined, "Total operating expenses", 100_000],
      [],
      [undefined, "Net profit", 800_000],
    ]);
  });

  it("calls a loss a loss", () => {
    const loss = buildProfitAndLoss("2026-09-23", "2026-10-22", ACCOUNTS, [
      { accountCode: "6100", debit: 100_000, credit: 0 },
    ]);
    expect(profitAndLossRows(loss, en, "en").at(-1)).toEqual([undefined, "Net loss", -100_000]);
  });

  it("writes in Persian, with Persian account names and dates, for a Persian reader", () => {
    const rows = profitAndLossRows(pl, fa, "fa");
    expect(rows[1]).toEqual([fa.period.periodLabel, "1405/07/01", "1405/07/30"]);
    expect(rows[5]).toEqual(["4100", "نوشیدنی", 1_000_000]);
  });

  it("includes profit not yet closed in the balance sheet's equity", () => {
    const rows = balanceSheetRows(buildBalanceSheet("2026-10-20", ACCOUNTS, MOVEMENTS), en, "en");
    expect(rows).toContainEqual(["1110", "Cash", 1_300_000]);
    expect(rows).toContainEqual([undefined, "Profit to date (not yet closed)", 800_000]);
    expect(rows.at(-1)).toEqual([undefined, "Total equity", 1_300_000]);
    expect(rows[1]).toEqual(["As of", "2026-10-20"]);
  });

  it("nets each account to one side of the trial balance", () => {
    const rows = trialBalanceRows(buildTrialBalance("2026-10-20", ACCOUNTS, MOVEMENTS), en, "en");
    expect(rows).toContainEqual(["1110", "Cash", 1_300_000, undefined]);
    expect(rows).toContainEqual(["4100", "Drinks", undefined, 1_000_000]);
    expect(rows.at(-1)).toEqual([undefined, "Totals", 1_500_000, 1_500_000]);
  });

  it("shows VAT on bills as what it takes off", () => {
    const rows = vatRows(
      {
        fromDay: "2026-09-23",
        toDay: "2026-10-22",
        outputVat: 90,
        inputVat: 30,
        settled: 10,
        netForPeriod: 60,
        closingBalance: 50,
      },
      en,
      "en",
    );
    expect(rows.slice(3)).toEqual([
      ["Item", "Amount"],
      ["VAT on sales", 90],
      ["VAT on bills", -30],
      ["Owed for the period", 60],
      ["Paid to the tax office", 10],
      ["Still owed at the end of the period", 50],
    ]);
  });

  it("gives margins as a percentage, and says when there's no cost to measure against", () => {
    const rows = marginRows(
      {
        fromDay: "2026-09-23",
        toDay: "2026-10-22",
        rows: [
          {
            productId: "a",
            name: "Latte",
            quantity: 3,
            netRevenue: 1000,
            cost: 575,
            grossProfit: 425,
            marginRate: 0.425,
          },
          { productId: "b", name: "Scone", quantity: 1, netRevenue: 200, cost: 0, grossProfit: 200, marginRate: null },
        ],
        totalNetRevenue: 1200,
        totalCost: 575,
        totalGrossProfit: 425,
        revenueWithoutCost: 200,
      },
      en,
      "en",
    );
    expect(rows[4]).toEqual(["Latte", 3, 1000, 575, 425, 42.5]);
    expect(rows[5]).toEqual(["Scone", 1, 200, undefined, undefined, "No cost price"]);
    expect(rows.at(-1)).toEqual(["Totals", undefined, 1200, 575, 425]);
  });
});

describe("journalCsv", () => {
  const ENTRY: JournalEntry = {
    id: "e1",
    number: 128,
    date: "2026-10-20",
    description: "Sale, table 4",
    source: "orderSale",
    lines: [
      { accountCode: "1110", debit: 1000, credit: 0 },
      { accountCode: "4100", debit: 0, credit: 1000, memo: "=cmd()" },
    ],
    createdById: "u1",
    createdByName: "Rira",
    createdAt: "",
  };

  async function* batches(...groups: JournalEntry[][]): AsyncGenerator<JournalEntry[]> {
    yield* groups;
  }

  async function csv(...groups: JournalEntry[][]): Promise<string[]> {
    const chunks: string[] = [];
    for await (const chunk of journalCsv(batches(...groups), ACCOUNTS, en, "en")) chunks.push(chunk);
    return chunks;
  }

  it("writes a row per line, with both calendars, and defuses staff-typed text", async () => {
    const [header, body] = await csv([ENTRY]);

    expect(header).toBe(
      "﻿Entry,Date,Persian date,Source,Description,Code,Account,Debit,Credit,Memo,Recorded by,Status\r\n",
    );
    expect(body).toBe(
      'JE-128,2026-10-20,1405/07/28,Sale,"Sale, table 4",1110,Cash,1000,,,Rira,\r\n' +
        'JE-128,2026-10-20,1405/07/28,Sale,"Sale, table 4",4100,Drinks,,1000,\'=cmd(),Rira,\r\n',
    );
  });

  it("marks an entry that was reversed", async () => {
    const [, body] = await csv([{ ...ENTRY, reversedById: "e2", lines: ENTRY.lines.slice(0, 1) }]);
    expect(body.trimEnd().endsWith(",Reversed")).toBe(true);
  });

  it("emits one chunk per batch, so a long journal never builds up in memory", async () => {
    expect(await csv([ENTRY], [ENTRY], [ENTRY])).toHaveLength(4);
  });

  it("still names the account when one isn't in the chart any more", async () => {
    const [, body] = await csv([{ ...ENTRY, lines: [{ accountCode: "9999", debit: 5, credit: 0 }] }]);
    expect(body).toContain(",9999,,5,");
  });
});
