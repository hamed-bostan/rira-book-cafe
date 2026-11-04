import { describe, expect, it } from "vitest";

import { GET as accountLedger } from "@/app/api/admin/accounting/accounts/[code]/ledger/route";
import { POST as autoMatch } from "@/app/api/admin/accounting/bank-statements/[id]/auto-match/route";
import { POST as recordLine } from "@/app/api/admin/accounting/bank-statements/[id]/lines/[lineId]/record/route";
import { DELETE as removeLine } from "@/app/api/admin/accounting/bank-statements/[id]/lines/[lineId]/route";
import { POST as addLines } from "@/app/api/admin/accounting/bank-statements/[id]/lines/route";
import { DELETE as unmatchLines } from "@/app/api/admin/accounting/bank-statements/[id]/matches/[matchId]/route";
import { POST as matchLines } from "@/app/api/admin/accounting/bank-statements/[id]/matches/route";
import { GET as getStatement } from "@/app/api/admin/accounting/bank-statements/[id]/route";
import { GET as listStatements, POST as createStatement } from "@/app/api/admin/accounting/bank-statements/route";
import { POST as postEntry } from "@/app/api/admin/accounting/journal/route";
import { GET as getSettings, PUT as saveSettings } from "@/app/api/admin/accounting/settings/route";
import { GET as listYears, POST as closeYear } from "@/app/api/admin/accounting/year-close/route";
import { POST as applyPrice } from "@/app/api/admin/pricing/items/[id]/apply/route";
import { PATCH as setMarkup } from "@/app/api/admin/pricing/items/[id]/route";
import { GET as getPricing } from "@/app/api/admin/pricing/route";
import type { BankStatement } from "@/src/domain/entities/BankReconciliation";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { fiscalYearDays, toJalali } from "@/src/domain/entities/JalaliCalendar";
import type { AccountingSettings, JournalEntry } from "@/src/domain/entities/Ledger";
import type { PricingReport } from "@/src/domain/entities/Pricing";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * Finance B's routes no other suite drives: bank statements end to end (create, add
 * and remove lines, record a fee, unmatch it, match by hand, auto-match), the year
 * close and the period lock after it, an account's ledger, and an item's own
 * markup and suggested price.
 */

const today = cafeDayOf(new Date());

/** Net debits − credits on an account, across everything posted. */
async function balanceOf(accountCode: string): Promise<number> {
  const sum = await prisma.journalLine.aggregate({ where: { accountCode }, _sum: { debit: true, credit: true } });
  return Number(sum._sum.debit ?? 0) - Number(sum._sum.credit ?? 0);
}

describe("a bank statement", () => {
  const fromDay = shiftCafeDay(today, -6);

  async function statement(lines: { amount: string; description: string }[]): Promise<BankStatement> {
    const response = await createStatement(
      jsonRequest("POST", "/api/admin/accounting/bank-statements", {
        fromDay,
        toDay: today,
        openingBalance: "0",
        closingBalance: "0",
        lines: lines.map((line) => ({ date: today, reference: "", ...line })),
      }),
    );
    expect(response.status).toBe(201);
    return readJson<BankStatement>(response);
  }

  async function view(id: string): Promise<{ statement: BankStatement }> {
    const response = await getStatement(getRequest(`/api/admin/accounting/bank-statements/${id}`), routeParams({ id }));
    expect(response.status).toBe(200);
    return readJson<{ statement: BankStatement }>(response);
  }

  function record(id: string, lineId: string, kind: string): Promise<Response> {
    return recordLine(
      jsonRequest("POST", `/api/admin/accounting/bank-statements/${id}/lines/${lineId}/record`, { kind, fee: "" }),
      routeParams({ id, lineId }),
    );
  }

  it("records a fee, and unmatching it takes the fee back, so recording again books it once", async () => {
    signInAs("admin");
    const { id } = await statement([{ amount: "-5000", description: "Monthly charge" }]);
    const line = (await view(id)).statement.lines[0];
    const fees = await balanceOf("6700");

    expect((await record(id, line.id, "fee")).status).toBe(201);
    expect(await balanceOf("6700")).toBe(fees + 5000);
    const matchId = (await view(id)).statement.lines[0].matchId ?? "";
    expect(matchId).not.toBe("");

    const unmatched = await unmatchLines(
      new Request(`http://test/api/admin/accounting/bank-statements/${id}/matches/${matchId}`, { method: "DELETE" }),
      routeParams({ id, matchId }),
    );
    expect(unmatched.status).toBe(204);
    // The fee entry went with the match, by a reversal.
    expect(await balanceOf("6700")).toBe(fees);
    expect((await view(id)).statement.lines[0].matchId).toBeUndefined();
    const fee = await prisma.journalEntry.findFirstOrThrow({ where: { source: "bankFee" } });
    expect(fee.reversedById).not.toBeNull();

    expect((await record(id, line.id, "fee")).status).toBe(201);
    expect(await balanceOf("6700")).toBe(fees + 5000);
  });

  it("adds a line, removes one, and matches a line to the books by hand", async () => {
    signInAs("admin");
    // Money into the bank the books already know of.
    const deposit = await postEntry(
      jsonRequest("POST", "/api/admin/accounting/journal", {
        date: today,
        description: "Owner's capital",
        lines: [
          { accountCode: "1120", debit: "2000000", credit: "", memo: "" },
          { accountCode: "3100", debit: "", credit: "2000000", memo: "" },
        ],
      }),
    );
    expect(deposit.status).toBe(201);
    const { id } = await statement([{ amount: "-1000", description: "Card fee" }]);

    const added = await addLines(
      jsonRequest("POST", `/api/admin/accounting/bank-statements/${id}/lines`, {
        lines: [{ date: today, description: "Capital in", reference: "", amount: "2000000" }],
      }),
      routeParams({ id }),
    );
    expect(added.status).toBe(201);
    const lines = (await view(id)).statement.lines;
    expect(lines).toHaveLength(2);

    const cardFee = lines.find((line) => line.amount === -1000);
    const removed = await removeLine(
      new Request(`http://test/api/admin/accounting/bank-statements/${id}/lines/${cardFee?.id}`, { method: "DELETE" }),
      routeParams({ id, lineId: cardFee?.id ?? "" }),
    );
    expect(removed.status).toBe(204);

    const capital = lines.find((line) => line.amount === 2000000);
    const ledgerLine = await prisma.journalLine.findFirstOrThrow({
      where: { accountCode: "1120", debit: 2000000 },
    });
    const matched = await matchLines(
      jsonRequest("POST", `/api/admin/accounting/bank-statements/${id}/matches`, {
        statementLineIds: [capital?.id],
        ledgerLineIds: [ledgerLine.id],
      }),
      routeParams({ id }),
    );
    expect(matched.status).toBe(204);
    const after = (await view(id)).statement.lines;
    expect(after).toHaveLength(1);
    expect(after[0].matchId).toBeDefined();

    // Nothing left to suggest.
    const auto = await autoMatch(
      jsonRequest("POST", `/api/admin/accounting/bank-statements/${id}/auto-match`, {}),
      routeParams({ id }),
    );
    expect(await readJson(auto)).toEqual({ matched: 0 });
    expect((await readJson<unknown[]>(await listStatements())).length).toBe(1);
  });

  it("keeps floor staff out (401)", async () => {
    signInAs("staff");

    expect((await listStatements()).status).toBe(401);
  });
});

describe("closing a fiscal year", () => {
  const lastYear = toJalali(today).jy - 1;
  const { toDay: yearEnd } = fiscalYearDays(lastYear);

  function lock(booksClosedThrough: string): Promise<Response> {
    return saveSettings(jsonRequest("PUT", "/api/admin/accounting/settings", { vatRate: "10", booksClosedThrough }));
  }

  it("closes last year, and after that the lock can move on but never back into it", async () => {
    signInAs("admin");
    // Something to close: rent paid on the year's last day.
    expect(
      (
        await postEntry(
          jsonRequest("POST", "/api/admin/accounting/journal", {
            date: yearEnd,
            description: "Rent",
            lines: [
              { accountCode: "6100", debit: "4000000", credit: "", memo: "" },
              { accountCode: "1110", debit: "", credit: "4000000", memo: "" },
            ],
          }),
        )
      ).status,
    ).toBe(201);

    const closed = await closeYear(jsonRequest("POST", "/api/admin/accounting/year-close", { year: lastYear }));
    expect(closed.status).toBe(201);
    expect((await readJson<JournalEntry>(closed)).source).toBe("yearClose");
    expect((await readJson<AccountingSettings>(await getSettings())).booksClosedThrough).toBe(yearEnd);
    const years = await readJson<{ year: number; closed: boolean }[]>(await listYears());
    expect(years.find((one) => one.year === lastYear)?.closed).toBe(true);

    for (const reopen of ["", shiftCafeDay(yearEnd, -1)]) {
      const refused = await lock(reopen);
      expect(refused.status).toBe(400);
      expect((await readError(refused)).fieldErrors).toEqual({ booksClosedThrough: "closedYearFinal" });
    }
    expect((await readJson<AccountingSettings>(await getSettings())).booksClosedThrough).toBe(yearEnd);

    expect((await lock(shiftCafeDay(yearEnd, 10))).status).toBe(200);
    // Closing it twice is refused.
    expect((await closeYear(jsonRequest("POST", "/api/admin/accounting/year-close", { year: lastYear }))).status).toBe(
      409,
    );
  });

  it("refuses the year still running (409)", async () => {
    signInAs("admin");

    const running = await closeYear(
      jsonRequest("POST", "/api/admin/accounting/year-close", { year: toJalali(today).jy }),
    );

    expect(running.status).toBe(409);
    expect((await readError(running)).code).toBe("YEAR_NOT_ENDED");
  });
});

describe("an account's ledger", () => {
  it("lists the account's lines in the period", async () => {
    signInAs("admin");
    await postEntry(
      jsonRequest("POST", "/api/admin/accounting/journal", {
        date: today,
        description: "Window cleaning",
        lines: [
          { accountCode: "6500", debit: "300000", credit: "", memo: "" },
          { accountCode: "1110", debit: "", credit: "300000", memo: "" },
        ],
      }),
    );

    const response = await accountLedger(
      getRequest(`/api/admin/accounting/accounts/6500/ledger?from=${today}&to=${today}`),
      routeParams({ code: "6500" }),
    );

    expect(response.status).toBe(200);
    expect(JSON.stringify(await readJson(response))).toContain("Window cleaning");
  });
});

describe("an item's price", () => {
  async function pricing(): Promise<PricingReport> {
    const response = await getPricing();
    expect(response.status).toBe(200);
    return readJson<PricingReport>(response);
  }

  it("takes its own markup, cleared back to the default with a blank", async () => {
    signInAs("admin");
    const [row] = (await pricing()).rows;
    const patch = (markup: string): Promise<Response> =>
      setMarkup(
        jsonRequest("PATCH", `/api/admin/pricing/items/${row.productId}`, { markup }),
        routeParams({ id: row.productId }),
      );

    expect((await patch("80")).status).toBe(204);
    expect((await pricing()).rows.find((one) => one.productId === row.productId)).toMatchObject({
      markupBps: 8000,
      markupIsDefault: false,
    });
    expect((await patch("")).status).toBe(204);
    expect((await pricing()).rows.find((one) => one.productId === row.productId)?.markupIsDefault).toBe(true);
    expect((await patch("abc")).status).toBe(400);
  });

  it("puts the suggested price on the menu, unless the price changed meanwhile (409)", async () => {
    signInAs("admin");
    const row = (await pricing()).rows.find((one) => one.suggestedPrice !== null && one.suggestedPrice !== one.price);
    if (!row) throw new Error("The seed has no item with a suggestion that differs from its price.");
    const apply = (expectedPrice: number): Promise<Response> =>
      applyPrice(
        jsonRequest("POST", `/api/admin/pricing/items/${row.productId}/apply`, { expectedPrice }),
        routeParams({ id: row.productId }),
      );

    expect((await apply(row.price + 1)).status).toBe(409);
    const applied = await apply(row.price);
    expect(applied.status).toBe(200);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: row.productId } });
    expect(Number(product.price)).toBe(row.suggestedPrice);
  });
});
