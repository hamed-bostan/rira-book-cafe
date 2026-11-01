import { describe, expect, it } from "vitest";

import { POST as postEntry } from "@/app/api/admin/accounting/journal/route";
import { GET as getReport } from "@/app/api/admin/accounting/reports/[report]/route";
import { POST as payExpense } from "@/app/api/admin/expenses/[id]/pay/route";
import { POST as voidExpense } from "@/app/api/admin/expenses/[id]/void/route";
import { POST as recordExpense } from "@/app/api/admin/expenses/route";
import type { CashFlowStatement, TrialBalance } from "@/src/domain/entities/AccountingReports";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Expense } from "@/src/domain/entities/Expense";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const yesterday = shiftCafeDay(today, -1);
const SPAN = `from=${today}&to=${today}`;

type Line = [accountCode: string, debit: number, credit: number];

async function post(lines: Line[], date = today): Promise<void> {
  const response = await postEntry(
    jsonRequest("POST", "/api/admin/accounting/journal", {
      date,
      description: "Test entry",
      lines: lines.map(([accountCode, debit, credit]) => ({
        accountCode,
        debit: debit ? String(debit) : "",
        credit: credit ? String(credit) : "",
        memo: "",
      })),
    }),
  );
  expect(response.status).toBe(201);
}

async function bill(amount: number, payment: string): Promise<Expense> {
  const response = await recordExpense(
    jsonRequest("POST", "/api/admin/expenses", {
      date: today,
      supplierId: "",
      accountCode: "6100",
      description: "Bill",
      amount: String(amount),
      vatAmount: "",
      payment,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Expense>(response);
}

async function report(query = SPAN): Promise<CashFlowStatement> {
  const response = await getReport(
    getRequest(`/api/admin/accounting/reports/cash-flow?${query}`),
    routeParams({ report: "cash-flow" }),
  );
  expect(response.status).toBe(200);
  return readJson<CashFlowStatement>(response);
}

const amounts = (section: CashFlowStatement["operating"]): Record<string, number> =>
  Object.fromEntries(section.rows.map((row) => [row.account.code, row.balance]));

describe("the cash-flow statement", () => {
  it("is for the books' readers", async () => {
    const request = (): Promise<Response> =>
      getReport(getRequest("/api/admin/accounting/reports/cash-flow"), routeParams({ report: "cash-flow" }));
    expect((await request()).status).toBe(401);

    signInAs("staff");
    expect((await request()).status).toBe(401);
  });

  it("sorts each kind of money into its section", async () => {
    signInAs("admin");
    await post([
      ["1120", 10_000_000, 0],
      ["3100", 0, 10_000_000],
    ]);
    await post([
      ["3300", 1_000_000, 0],
      ["1110", 0, 1_000_000],
    ]);
    await post([
      ["1500", 3_000_000, 0],
      ["1120", 0, 3_000_000],
    ]);
    await post([
      ["1110", 1_100_000, 0],
      ["4100", 0, 1_000_000],
      ["2200", 0, 100_000],
    ]);
    await bill(2_000_000, "bank");

    const flow = await report();

    expect(amounts(flow.financing)).toEqual({ "3100": 10_000_000, "3300": -1_000_000 });
    expect(amounts(flow.investing)).toEqual({ "1500": -3_000_000 });
    expect(amounts(flow.operating)).toEqual({ "2200": 100_000, "4100": 1_000_000, "6100": -2_000_000 });
    expect(flow.financing.total).toBe(9_000_000);
    expect(flow.investing.total).toBe(-3_000_000);
    expect(flow.operating.total).toBe(-900_000);
    expect(flow.netChange).toBe(5_100_000);
  });

  it("counts a bill when it's paid, not when it's booked", async () => {
    signInAs("admin");
    const owed = await bill(1_000_000, "unpaid");
    expect((await report()).netChange).toBe(0);

    const paid = await payExpense(
      jsonRequest("POST", `/api/admin/expenses/${owed.id}/pay`, { source: "bank", paidOn: today, amount: "400000" }),
      routeParams({ id: owed.id }),
    );
    expect(paid.status).toBe(200);

    const flow = await report();
    expect(amounts(flow.operating)).toEqual({ "2100": -400_000 });
    expect(flow.netChange).toBe(-400_000);
  });

  it("leaves out a move between the till and the bank", async () => {
    signInAs("admin");
    await post([
      ["1120", 500_000, 0],
      ["1110", 0, 500_000],
    ]);

    const flow = await report();

    expect(flow.operating.rows).toEqual([]);
    expect(flow.netChange).toBe(0);
  });

  it("ignores what else an entry booked when its cash only moved between accounts", async () => {
    signInAs("admin");
    await post([
      ["1120", 500_000, 0],
      ["1110", 0, 500_000],
      ["6100", 100_000, 0],
      ["2100", 0, 100_000],
    ]);

    const flow = await report();

    expect(flow.operating.rows).toEqual([]);
    expect(flow.reconciled).toBe(true);
  });

  it("nets a voided expense away", async () => {
    signInAs("admin");
    const mistake = await bill(700_000, "cash");
    const voided = await voidExpense(
      jsonRequest("POST", `/api/admin/expenses/${mistake.id}/void`, { reason: "Entered twice" }),
      routeParams({ id: mistake.id }),
    );
    expect(voided.status).toBe(200);

    const flow = await report();

    expect(flow.operating.rows).toEqual([]);
    expect(flow.netChange).toBe(0);
    expect(flow.reconciled).toBe(true);
  });

  it("starts from the cash before the period, and ends on the cash in the books", async () => {
    signInAs("admin");
    await post(
      [
        ["1110", 5_000_000, 0],
        ["3100", 0, 5_000_000],
      ],
      yesterday,
    );
    await post([
      ["6100", 750_000, 0],
      ["1120", 0, 750_000],
    ]);

    const flow = await report();

    expect(flow.openingCash).toBe(5_000_000);
    expect(flow.netChange).toBe(-750_000);
    expect(flow.closingCash).toBe(4_250_000);
    expect(flow.reconciled).toBe(true);

    // Nothing from before the period counts as a flow within it.
    expect(amounts(flow.financing)).toEqual({});

    const balances = await readJson<TrialBalance>(
      await getReport(
        getRequest(`/api/admin/accounting/reports/trial-balance?asOf=${today}`),
        routeParams({ report: "trial-balance" }),
      ),
    );
    const cashInBooks = balances.rows
      .filter((row) => ["1110", "1120", "1130"].includes(row.account.code))
      .reduce((sum, row) => sum + row.balance, 0);
    expect(flow.closingCash).toBe(cashInBooks);
  });

  it("answers 400 for a span that runs backwards", async () => {
    signInAs("admin");
    const response = await getReport(
      getRequest(`/api/admin/accounting/reports/cash-flow?from=${today}&to=${yesterday}`),
      routeParams({ report: "cash-flow" }),
    );

    expect(response.status).toBe(400);
  });
});
