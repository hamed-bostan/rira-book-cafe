import { describe, expect, it } from "vitest";

import { POST as postEntry } from "@/app/api/admin/accounting/journal/route";
import { GET as listActors } from "@/app/api/admin/activity/actors/route";
import { GET as readActivity } from "@/app/api/admin/activity/route";
import { POST as recordExpense } from "@/app/api/admin/expenses/route";
import { POST as createEmployee } from "@/app/api/admin/payroll/employees/route";
import type { ActivityEntry } from "@/src/domain/entities/ActivityEntry";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { Expense } from "@/src/domain/entities/Expense";
import type { Page } from "@/src/domain/entities/Pagination";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readJson } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());

/** An unusual total, so a leak can be searched for by value. */
const BILL_TOTAL = 37_654_321;
const COST_BEFORE = "41234";
const COST_AFTER = "45678";

async function bill(): Promise<Expense> {
  const response = await recordExpense(
    jsonRequest("POST", "/api/admin/expenses", {
      date: today,
      supplierId: "",
      accountCode: "6100",
      description: "Rent, private",
      amount: String(BILL_TOTAL),
      vatAmount: "",
      payment: "unpaid",
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Expense>(response);
}

async function manualEntry(): Promise<void> {
  const response = await postEntry(
    jsonRequest("POST", "/api/admin/accounting/journal", {
      date: today,
      description: "Owner's capital, private",
      lines: [
        { accountCode: "1110", debit: String(BILL_TOTAL), credit: "", memo: "" },
        { accountCode: "3100", debit: "", credit: String(BILL_TOTAL), memo: "" },
      ],
    }),
  );
  expect(response.status).toBe(201);
}

async function employee(): Promise<void> {
  const response = await createEmployee(
    jsonRequest("POST", "/api/admin/payroll/employees", {
      name: "Sara, private",
      position: "",
      phone: "",
      monthlySalary: "20000000",
      isActive: true,
    }),
  );
  expect(response.status).toBe(201);
}

/** A product's history as a save writes it, with a cost price among the fields that moved. */
async function repricedProduct(id = "p1"): Promise<void> {
  await prisma.activityEntry.create({
    data: {
      actorId: TEST_USERS.admin.id,
      actorName: TEST_USERS.admin.name,
      action: "product.updated",
      entityType: "product",
      entityId: id,
      entityLabel: "Latte",
      changes: [
        { field: "price", before: "90000", after: "95000" },
        { field: "costPrice", before: COST_BEFORE, after: COST_AFTER },
      ],
      changedFields: ["price", "costPrice"],
    },
  });
}

async function page(query = ""): Promise<Page<ActivityEntry>> {
  const response = await readActivity(getRequest(`/api/admin/activity${query}`));
  expect(response.status).toBe(200);
  return readJson<Page<ActivityEntry>>(response);
}

describe("floor staff reading the activity log", () => {
  it("see the floor's entries, and nothing from the books or payroll", async () => {
    signInAs("admin");
    await bill();
    await manualEntry();
    await employee();
    await repricedProduct();

    signInAs("staff");
    const { items } = await page();

    expect(items.map((entry) => entry.entityType)).toEqual(["product"]);
  });

  it("can't reach the books' entries by asking for them", async () => {
    signInAs("admin");
    const expense = await bill();

    signInAs("staff");
    expect((await page("?entityType=expense")).items).toEqual([]);
    expect((await page("?action=expense.recorded")).items).toEqual([]);
    expect((await page("?field=amount")).items).toEqual([]);
    expect((await page(`?entityId=${expense.id}`)).items).toEqual([]);
  });

  it.each(["expense", "ledger", "income", "payroll", "user"])("are refused a %s panel by id", async (entityType) => {
    signInAs("staff");
    const response = await readActivity(
      getRequest(`/api/admin/activity?entityType=${entityType}&entityId=any&limit=5`),
    );

    expect(response.status).toBe(401);
  });

  it("never receive a figure from the books", async () => {
    signInAs("admin");
    await bill();
    await manualEntry();

    signInAs("staff");
    const response = await readActivity(getRequest("/api/admin/activity?pageSize=100"));

    expect(await response.text()).not.toContain(String(BILL_TOTAL));
  });

  it("see that a cost price changed, not what to", async () => {
    await repricedProduct();

    signInAs("staff");
    const response = await readActivity(getRequest("/api/admin/activity"));
    const body = await response.text();

    expect(body).toContain("costPrice");
    expect(body).not.toContain(COST_BEFORE);
    expect(body).not.toContain(COST_AFTER);
    // The menu price is public, so it stays.
    expect(body).toContain("95000");
  });

  it("have a cost price masked on a product's own panel too", async () => {
    await repricedProduct("p9");

    signInAs("staff");
    const response = await readActivity(getRequest("/api/admin/activity?entityType=product&entityId=p9&limit=5"));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("costPrice");
    expect(body).not.toContain(COST_AFTER);
  });

  it("aren't told about people whose only entries are hidden from them", async () => {
    signInAs("admin");
    await bill();

    signInAs("staff");
    const actors = await readJson<{ id: string }[]>(await listActors());

    expect(actors.map((actor) => actor.id)).not.toContain(TEST_USERS.admin.id);
  });
});

describe("admins and the owner reading it", () => {
  it("admins see the books, payroll and cost prices, but not team access", async () => {
    signInAs("admin");
    await bill();
    await employee();
    await repricedProduct();
    await prisma.activityEntry.create({
      data: {
        actorId: TEST_USERS.owner.id,
        actorName: TEST_USERS.owner.name,
        action: "user.roleChanged",
        entityType: "user",
        entityId: "u1",
        changes: [],
        changedFields: [],
      },
    });

    const { items } = await page();
    const types = new Set(items.map((entry) => entry.entityType));

    expect(types).toEqual(new Set(["expense", "payroll", "product"]));
    expect(JSON.stringify(items)).toContain(COST_AFTER);
  });

  it("the owner sees everything", async () => {
    signInAs("admin");
    await bill();
    await prisma.activityEntry.create({
      data: {
        actorId: TEST_USERS.owner.id,
        actorName: TEST_USERS.owner.name,
        action: "user.roleChanged",
        entityType: "user",
        entityId: "u1",
        changes: [],
        changedFields: [],
      },
    });

    signInAs("owner");
    const types = new Set((await page()).items.map((entry) => entry.entityType));

    expect(types).toEqual(new Set(["expense", "user"]));
  });
});
