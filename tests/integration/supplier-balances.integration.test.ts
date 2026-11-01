import { describe, expect, it } from "vitest";

import { GET as getReport } from "@/app/api/admin/accounting/reports/[report]/route";
import { POST as payExpense } from "@/app/api/admin/expenses/[id]/pay/route";
import { POST as voidExpense } from "@/app/api/admin/expenses/[id]/void/route";
import { GET as listExpenses, POST as recordExpense } from "@/app/api/admin/expenses/route";
import { GET as getBalances } from "@/app/api/admin/suppliers/balances/route";
import { POST as createSupplier } from "@/app/api/admin/suppliers/route";
import type { TrialBalance } from "@/src/domain/entities/AccountingReports";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { Expense, Supplier, SupplierBalances } from "@/src/domain/entities/Expense";
import { SYSTEM_ACCOUNTS } from "@/src/domain/entities/Ledger";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());

async function supplier(name: string): Promise<Supplier> {
  const response = await createSupplier(
    jsonRequest("POST", "/api/admin/suppliers", { name, phone: "", note: "", isActive: true }),
  );
  expect(response.status).toBe(201);
  return readJson<Supplier>(response);
}

async function bill(amount: number, supplierId = "", payment = "unpaid"): Promise<Expense> {
  const response = await recordExpense(
    jsonRequest("POST", "/api/admin/expenses", {
      date: today,
      supplierId,
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

async function pay(id: string, amount: number): Promise<void> {
  const response = await payExpense(
    jsonRequest("POST", `/api/admin/expenses/${id}/pay`, { source: "bank", paidOn: today, amount: String(amount) }),
    routeParams({ id }),
  );
  expect(response.status).toBe(200);
}

async function balances(): Promise<SupplierBalances> {
  const response = await getBalances();
  expect(response.status).toBe(200);
  return readJson<SupplierBalances>(response);
}

describe("supplier balances", () => {
  it("is for the books' readers", async () => {
    expect((await getBalances()).status).toBe(401);

    signInAs("staff");
    expect((await getBalances()).status).toBe(401);
  });

  it("takes part payments off what's owed, and stops counting a bill once it's settled", async () => {
    signInAs("admin");
    const mehr = await supplier("Mehr");
    const first = await bill(1_000_000, mehr.id);
    await bill(500_000, mehr.id);

    await pay(first.id, 400_000);
    expect((await balances()).suppliers).toEqual([{ supplierId: mehr.id, billCount: 2, owed: 1_100_000 }]);

    await pay(first.id, 600_000);
    expect((await balances()).suppliers).toEqual([{ supplierId: mehr.id, billCount: 1, owed: 500_000 }]);
  });

  it("leaves out bills paid on the spot and voided ones", async () => {
    signInAs("admin");
    const mehr = await supplier("Mehr");
    await bill(300_000, mehr.id, "cash");
    const mistake = await bill(200_000, mehr.id);
    const voided = await voidExpense(
      jsonRequest("POST", `/api/admin/expenses/${mistake.id}/void`, { reason: "Entered twice" }),
      routeParams({ id: mistake.id }),
    );
    expect(voided.status).toBe(200);

    expect(await balances()).toEqual({ suppliers: [], noSupplier: { billCount: 0, owed: 0 }, total: 0 });
  });

  it("adds up to the Expenses page's figure and to accounts payable in the books", async () => {
    signInAs("admin");
    const [mehr, sahar] = [await supplier("Mehr"), await supplier("Sahar")];
    const partPaid = await bill(1_000_000, mehr.id);
    await pay(partPaid.id, 250_000);
    await bill(400_000, sahar.id);
    await bill(90_000);

    const result = await balances();
    expect(result.noSupplier).toEqual({ billCount: 1, owed: 90_000 });
    expect(result.total).toBe(1_240_000);

    const list = await readJson<{ totalUnpaid: number }>(await listExpenses(getRequest("/api/admin/expenses")));
    expect(result.total).toBe(list.totalUnpaid);

    const report = await getReport(
      getRequest(`/api/admin/accounting/reports/trial-balance?asOf=${today}`),
      routeParams({ report: "trial-balance" }),
    );
    const { rows } = await readJson<TrialBalance>(report);
    expect(rows.find((row) => row.account.code === SYSTEM_ACCOUNTS.accountsPayable)?.balance).toBe(result.total);
  });
});
