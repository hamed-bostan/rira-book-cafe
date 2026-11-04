import { describe, expect, it } from "vitest";

import { PATCH as setAccountActive } from "@/app/api/admin/accounting/accounts/[code]/route";
import { POST as createAccount } from "@/app/api/admin/accounting/accounts/route";
import { POST as voidExpense } from "@/app/api/admin/expenses/[id]/void/route";
import { POST as recordExpense } from "@/app/api/admin/expenses/route";
import { POST as voidIncome } from "@/app/api/admin/income/[id]/void/route";
import { POST as recordIncome } from "@/app/api/admin/income/route";
import { PUT as updateSupplier } from "@/app/api/admin/suppliers/[id]/route";
import { GET as listSuppliers, POST as createSupplier } from "@/app/api/admin/suppliers/route";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { Expense, Supplier } from "@/src/domain/entities/Expense";
import type { Income } from "@/src/domain/entities/Income";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * Finance A's routes no other suite drives — editing and switching off a supplier —
 * and voids once their account was switched off: switching an account off stops new
 * bookings to it, but a void only takes back one made while it was on.
 */

const today = cafeDayOf(new Date());

/** Net debits − credits on an account, across everything posted. */
async function balanceOf(accountCode: string): Promise<number> {
  const sum = await prisma.journalLine.aggregate({ where: { accountCode }, _sum: { debit: true, credit: true } });
  return Number(sum._sum.debit ?? 0) - Number(sum._sum.credit ?? 0);
}

function switchAccount(code: string, isActive: boolean): Promise<Response> {
  return setAccountActive(
    jsonRequest("PATCH", `/api/admin/accounting/accounts/${code}`, { isActive }),
    routeParams({ code }),
  );
}

async function expenseOn(accountCode: string): Promise<Response> {
  return recordExpense(
    jsonRequest("POST", "/api/admin/expenses", {
      date: today,
      supplierId: "",
      accountCode,
      description: "Window cleaning",
      amount: "300000",
      vatAmount: "",
      payment: "cash",
    }),
  );
}

describe("a void after its account was switched off", () => {
  it("takes an expense back, though no new expense may go to that account", async () => {
    signInAs("admin");
    const recorded = await expenseOn("6100");
    expect(recorded.status).toBe(201);
    const expense = await readJson<Expense>(recorded);
    const before = await balanceOf("6100");
    expect((await switchAccount("6100", false)).status).toBe(200);

    const refused = await expenseOn("6100");
    expect(refused.status).toBe(400);
    expect((await readError(refused)).fieldErrors).toHaveProperty("accountCode");

    const voided = await voidExpense(
      jsonRequest("POST", `/api/admin/expenses/${expense.id}/void`, { reason: "Booked to the old account" }),
      routeParams({ id: expense.id }),
    );
    expect(voided.status).toBe(200);
    expect((await readJson<Expense>(voided)).status).toBe("void");
    expect(await balanceOf("6100")).toBe(before - 300000);
  });

  it("takes an income back from a revenue account switched off since", async () => {
    signInAs("admin");
    // The seeded revenue accounts are the system's own and can't be switched off; a
    // cafe's own one can.
    const opened = await createAccount(
      jsonRequest("POST", "/api/admin/accounting/accounts", {
        code: "4950",
        name: "Room hire",
        nameFa: "اجاره سالن",
        type: "revenue",
      }),
    );
    expect(opened.status).toBe(201);
    const recorded = await recordIncome(
      jsonRequest("POST", "/api/admin/income", {
        date: today,
        payerName: "Book club",
        description: "Room hire",
        accountCode: "4950",
        amount: "500000",
        vatAmount: "",
        method: "cash",
      }),
    );
    expect(recorded.status).toBe(201);
    const income = await readJson<Income>(recorded);
    expect((await switchAccount("4950", false)).status).toBe(200);

    const voided = await voidIncome(
      jsonRequest("POST", `/api/admin/income/${income.id}/void`, { reason: "Entered twice" }),
      routeParams({ id: income.id }),
    );

    expect(voided.status).toBe(200);
    expect(await balanceOf("4950")).toBe(0);
  });
});

describe("a supplier", () => {
  async function supplier(name: string): Promise<Supplier> {
    const response = await createSupplier(
      jsonRequest("POST", "/api/admin/suppliers", { name, phone: "", note: "", isActive: true }),
    );
    expect(response.status).toBe(201);
    return readJson<Supplier>(response);
  }

  function update(id: string, body: unknown): Promise<Response> {
    return updateSupplier(jsonRequest("PUT", `/api/admin/suppliers/${id}`, body), routeParams({ id }));
  }

  async function listed(all: boolean): Promise<Supplier[]> {
    return readJson<Supplier[]>(await listSuppliers(getRequest(`/api/admin/suppliers${all ? "?all=true" : ""}`)));
  }

  it("is edited, and switched off it leaves the picker but stays on the full list", async () => {
    signInAs("admin");
    const dairy = await supplier("Dairy Co");

    const edited = await update(dairy.id, { name: "Dairy Co-op", phone: "021 4455 6677", note: "", isActive: true });
    expect(edited.status).toBe(200);
    expect(await readJson<Supplier>(edited)).toMatchObject({ name: "Dairy Co-op", phone: "021 4455 6677" });

    expect((await update(dairy.id, { name: "Dairy Co-op", phone: "", note: "", isActive: false })).status).toBe(200);
    expect((await listed(false)).map((one) => one.id)).not.toContain(dairy.id);
    expect((await listed(true)).find((one) => one.id === dairy.id)).toMatchObject({ isActive: false });
  });

  it("refuses a blank name (400), an unknown supplier (404) and floor staff (401)", async () => {
    signInAs("admin");
    const dairy = await supplier("Dairy Co");

    const blank = await update(dairy.id, { name: " ", phone: "", note: "", isActive: true });
    expect(blank.status).toBe(400);
    expect((await readError(blank)).fieldErrors).toMatchObject({ name: "nameRequired" });
    expect((await update("nope", { name: "X", phone: "", note: "", isActive: true })).status).toBe(404);

    signInAs("staff");
    expect((await update(dairy.id, { name: "Hacked", phone: "", note: "", isActive: true })).status).toBe(401);
  });
});
