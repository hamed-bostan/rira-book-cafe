import { describe, expect, it } from "vitest";

import { POST as reverseEntry } from "@/app/api/admin/accounting/journal/[id]/reverse/route";
import { GET as listJournal, POST as postEntry } from "@/app/api/admin/accounting/journal/route";
import { GET as getReport } from "@/app/api/admin/accounting/reports/[report]/route";
import { GET as listExpenses, POST as recordExpense } from "@/app/api/admin/expenses/route";
import { POST as createSupplier } from "@/app/api/admin/suppliers/route";
import type { TrialBalance } from "@/src/domain/entities/AccountingReports";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { Expense } from "@/src/domain/entities/Expense";
import type { JournalEntry } from "@/src/domain/entities/Ledger";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());

/** The owner puts money into the business: cash up, capital up. */
const capitalInjection = {
  date: today,
  description: "Owner's opening capital",
  lines: [
    { accountCode: "1110", debit: "5000000", credit: "", memo: "" },
    { accountCode: "3100", debit: "", credit: "5000000", memo: "" },
  ],
};

const rent = {
  date: today,
  supplierId: "",
  accountCode: "6100",
  description: "October rent",
  amount: "30000000",
  vatAmount: "",
  payment: "bank",
};

async function trialBalance(): Promise<TrialBalance> {
  const response = await getReport(
    getRequest(`/api/admin/accounting/reports/trial-balance?asOf=${today}`),
    routeParams({ report: "trial-balance" }),
  );
  expect(response.status).toBe(200);
  return readJson<TrialBalance>(response);
}

describe("manual journal entries", () => {
  it("are for accountants only", async () => {
    expect((await postEntry(jsonRequest("POST", "/api/admin/accounting/journal", capitalInjection))).status).toBe(401);

    signInAs("staff");
    expect((await postEntry(jsonRequest("POST", "/api/admin/accounting/journal", capitalInjection))).status).toBe(401);
    expect((await listJournal(getRequest("/api/admin/accounting/journal"))).status).toBe(401);
  });

  it("refuses an unbalanced entry with 400", async () => {
    signInAs("admin");
    const response = await postEntry(
      jsonRequest("POST", "/api/admin/accounting/journal", {
        ...capitalInjection,
        lines: [capitalInjection.lines[0], { ...capitalInjection.lines[1], credit: "4000000" }],
      }),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ lines: "entryUnbalanced" });
  });

  it("refuses a future-dated entry with 400", async () => {
    signInAs("admin");
    const response = await postEntry(
      jsonRequest("POST", "/api/admin/accounting/journal", { ...capitalInjection, date: "2999-01-01" }),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toHaveProperty("date");
  });

  it("posts a balanced entry, keeps the books balanced, and reverses it", async () => {
    signInAs("admin");

    const posted = await postEntry(jsonRequest("POST", "/api/admin/accounting/journal", capitalInjection));
    expect(posted.status).toBe(201);
    const entry = await readJson<JournalEntry>(posted);
    expect(entry).toMatchObject({ description: "Owner's opening capital", source: "manual" });

    const balance = await trialBalance();
    expect(balance.balanced).toBe(true);
    expect(balance.rows.find((row) => row.account.code === "3100")).toBeDefined();

    const reversed = await reverseEntry(
      jsonRequest("POST", `/api/admin/accounting/journal/${entry.id}/reverse`, { date: today, reason: "Posted twice" }),
      routeParams({ id: entry.id }),
    );
    expect(reversed.status).toBe(201);

    // Reversing it again is refused: the entry has already been reversed.
    const twice = await reverseEntry(
      jsonRequest("POST", `/api/admin/accounting/journal/${entry.id}/reverse`, { date: today, reason: "Again" }),
      routeParams({ id: entry.id }),
    );
    expect(twice.status).toBe(409);
  });

  it("answers 404 when reversing an entry that doesn't exist", async () => {
    signInAs("admin");
    const id = "00000000-0000-0000-0000-000000000000";

    const response = await reverseEntry(
      jsonRequest("POST", `/api/admin/accounting/journal/${id}/reverse`, { date: today, reason: "Typo" }),
      routeParams({ id }),
    );

    expect(response.status).toBe(404);
  });

  it("answers 404 for a report that doesn't exist", async () => {
    signInAs("admin");

    const response = await getReport(
      getRequest("/api/admin/accounting/reports/horoscope"),
      routeParams({ report: "horoscope" }),
    );

    expect(response.status).toBe(404);
  });
});

describe("expenses and suppliers", () => {
  it("records a paid expense and posts it to the ledger", async () => {
    signInAs("admin");
    const entriesBefore = await prisma.journalEntry.count();

    const response = await recordExpense(jsonRequest("POST", "/api/admin/expenses", rent));

    expect(response.status).toBe(201);
    const expense = await readJson<Expense>(response);
    expect(expense).toMatchObject({ accountCode: "6100", amount: 30000000, status: "paid", paidFrom: "bank" });
    expect(await prisma.journalEntry.count()).toBe(entriesBefore + 1);
    expect((await trialBalance()).balanced).toBe(true);

    const list = await listExpenses(getRequest("/api/admin/expenses"));
    expect(list.status).toBe(200);
  });

  it("validates an expense with 400 and per-field errors", async () => {
    signInAs("admin");
    const response = await recordExpense(
      jsonRequest("POST", "/api/admin/expenses", { ...rent, amount: "", vatAmount: "5", payment: "barter" }),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({
      amount: "amountRequired",
      payment: "paymentInvalid",
    });
  });

  it("refuses an expense for staff without accounting.write", async () => {
    signInAs("staff");

    expect((await recordExpense(jsonRequest("POST", "/api/admin/expenses", rent))).status).toBe(401);
    expect(await prisma.expense.count()).toBe(0);
  });

  it("creates a supplier and books an unpaid bill against it", async () => {
    signInAs("admin");

    const created = await createSupplier(
      jsonRequest("POST", "/api/admin/suppliers", { name: "Lahijan Tea Co.", phone: "", note: "", isActive: true }),
    );
    expect(created.status).toBe(201);
    const supplier = await readJson<{ id: string; name: string }>(created);

    const bill = await recordExpense(
      jsonRequest("POST", "/api/admin/expenses", {
        ...rent,
        supplierId: supplier.id,
        accountCode: "6400",
        description: "Tea delivery",
        amount: "4400000",
        vatAmount: "400000",
        payment: "unpaid",
      }),
    );
    expect(bill.status).toBe(201);
    expect(await readJson<Expense>(bill)).toMatchObject({
      status: "unpaid",
      supplierName: "Lahijan Tea Co.",
      vatAmount: 400000,
    });
  });
});
