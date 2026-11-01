import { describe, expect, it } from "vitest";

import { POST as voidExpense } from "@/app/api/admin/expenses/[id]/void/route";
import { POST as recordBill } from "@/app/api/admin/recurring-bills/[id]/record/route";
import { PUT as updateBill } from "@/app/api/admin/recurring-bills/[id]/route";
import { POST as skipBill } from "@/app/api/admin/recurring-bills/[id]/skip/route";
import { GET as listDue } from "@/app/api/admin/recurring-bills/due/route";
import { GET as listBills, POST as createBill } from "@/app/api/admin/recurring-bills/route";
import { POST as createSupplier } from "@/app/api/admin/suppliers/route";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Expense, Supplier } from "@/src/domain/entities/Expense";
import { toJalali } from "@/src/domain/entities/JalaliCalendar";
import type { DueBill, RecurringBill } from "@/src/domain/entities/RecurringBill";
import { prisma } from "@/src/infrastructure/prisma/client";

import { jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const { jy, jm, jd } = toJalali(today);
const THIS_MONTH = `${jy}-${String(jm).padStart(2, "0")}`;
const NEXT_MONTH = jm === 12 ? `${jy + 1}-01` : `${jy}-${String(jm + 1).padStart(2, "0")}`;

const RENT = {
  description: "Rent",
  accountCode: "6100",
  supplierId: "",
  amount: "30000000",
  vatAmount: "",
  // Today, so this month's has just fallen due.
  dayOfMonth: jd,
  isActive: true,
};

/** What the record dialog sends once someone has checked the figures. */
const figures = (overrides: object = {}) => ({
  date: today,
  supplierId: "",
  accountCode: "6100",
  description: "Rent, this month",
  amount: "31000000",
  vatAmount: "",
  payment: "unpaid",
  period: THIS_MONTH,
  ...overrides,
});

async function bill(body: object = RENT): Promise<RecurringBill> {
  const response = await createBill(jsonRequest("POST", "/api/admin/recurring-bills", body));
  expect(response.status).toBe(201);
  return readJson<RecurringBill>(response);
}

const record = (id: string, body: object = figures()): Promise<Response> =>
  recordBill(jsonRequest("POST", `/api/admin/recurring-bills/${id}/record`, body), routeParams({ id }));

const skip = (id: string, period = THIS_MONTH): Promise<Response> =>
  skipBill(jsonRequest("POST", `/api/admin/recurring-bills/${id}/skip`, { period }), routeParams({ id }));

async function due(): Promise<DueBill[]> {
  const response = await listDue();
  expect(response.status).toBe(200);
  return readJson<DueBill[]>(response);
}

describe("access", () => {
  it("reading is for the books' readers, and changing for those who write to them", async () => {
    expect((await listBills()).status).toBe(401);
    expect((await listDue()).status).toBe(401);

    signInAs("staff");
    expect((await listBills()).status).toBe(401);
    expect((await listDue()).status).toBe(401);
    expect((await createBill(jsonRequest("POST", "/api/admin/recurring-bills", RENT))).status).toBe(401);

    signInAs("admin");
    const { id } = await bill();

    signInAs("staff");
    expect((await record(id)).status).toBe(401);
    expect((await skip(id)).status).toBe(401);
  });
});

describe("setting up a bill", () => {
  it("books nothing, however long it's left", async () => {
    signInAs("admin");
    const [expenses, entries] = [await prisma.expense.count(), await prisma.journalEntry.count()];

    await bill();
    await due();

    expect(await prisma.expense.count()).toBe(expenses);
    expect(await prisma.journalEntry.count()).toBe(entries);
  });

  it("names its supplier", async () => {
    signInAs("admin");
    const supplier = await readJson<Supplier>(
      await createSupplier(
        jsonRequest("POST", "/api/admin/suppliers", { name: "Landlord", phone: "", note: "", isActive: true }),
      ),
    );

    expect(await bill({ ...RENT, supplierId: supplier.id })).toMatchObject({ supplierName: "Landlord" });
  });

  it.each([
    ["VAT as high as the total", { vatAmount: "30000000" }, "vatAmount"],
    ["a day no month has", { dayOfMonth: 32 }, "dayOfMonth"],
    ["no account", { accountCode: "" }, "accountCode"],
  ])("refuses %s with 400", async (_label, overrides, field) => {
    signInAs("admin");
    const response = await createBill(jsonRequest("POST", "/api/admin/recurring-bills", { ...RENT, ...overrides }));

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toHaveProperty(field);
  });

  it("refuses an account a bill can't be booked to", async () => {
    signInAs("admin");
    const response = await createBill(
      jsonRequest("POST", "/api/admin/recurring-bills", { ...RENT, accountCode: "4100" }),
    );

    expect(response.status).toBe(400);
  });

  it("answers 404 for a supplier that doesn't exist", async () => {
    signInAs("admin");
    const response = await createBill(
      jsonRequest("POST", "/api/admin/recurring-bills", {
        ...RENT,
        supplierId: "00000000-0000-0000-0000-000000000000",
      }),
    );

    expect(response.status).toBe(404);
  });

  it("logs an edit, and switching a bill off stops it being asked about", async () => {
    signInAs("admin");
    const { id } = await bill();
    expect(await due()).toHaveLength(1);

    const response = await updateBill(
      jsonRequest("PUT", `/api/admin/recurring-bills/${id}`, { ...RENT, isActive: false }),
      routeParams({ id }),
    );

    expect(response.status).toBe(200);
    expect(await due()).toEqual([]);
    const log = await prisma.activityEntry.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } });
    expect(log.at(-1)?.changes).toEqual([{ field: "isActive", before: "true", after: "false" }]);
  });
});

describe("what's due", () => {
  it("shows a month once its day comes round", async () => {
    signInAs("admin");
    const { id } = await bill();

    expect(await due()).toMatchObject([{ bill: { id }, period: THIS_MONTH, dueOn: today }]);
  });

  it("keeps showing months nobody dealt with, oldest first", async () => {
    signInAs("admin");
    const { id } = await bill();
    await prisma.recurringBill.update({
      where: { id },
      data: { startsOn: new Date(`${shiftCafeDay(today, -70)}T00:00:00.000Z`) },
    });

    const months = (await due()).map((item) => item.period);

    expect(months.length).toBeGreaterThanOrEqual(2);
    expect(months).toEqual([...months].sort());
    expect(months.at(-1)).toBe(THIS_MONTH);
  });
});

describe("recording a month", () => {
  it("books the figures someone checked, not the usual ones, and the month stops being asked about", async () => {
    signInAs("admin");
    const { id } = await bill();

    const response = await record(id);

    expect(response.status).toBe(201);
    const expense = await readJson<Expense>(response);
    expect(expense).toMatchObject({ amount: 31_000_000, status: "unpaid", description: "Rent, this month" });
    expect(await prisma.journalEntry.count({ where: { sourceId: expense.id } })).toBe(1);
    expect(await due()).toEqual([]);
  });

  it("can be paid on the spot like any expense", async () => {
    signInAs("admin");
    const { id } = await bill();

    const expense = await readJson<Expense>(await record(id, figures({ payment: "bank" })));

    expect(expense).toMatchObject({ status: "paid", paidFrom: "bank" });
  });

  it("books a month once, however many ask at the same moment", async () => {
    signInAs("admin");
    const { id } = await bill();
    const [expenses, entries] = [await prisma.expense.count(), await prisma.journalEntry.count()];

    const answers = await Promise.all([record(id), record(id), record(id)]);

    expect(answers.map((answer) => answer.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.expense.count()).toBe(expenses + 1);
    expect(await prisma.journalEntry.count()).toBe(entries + 1);
  });

  it("refuses a second try afterwards, with nothing left behind", async () => {
    signInAs("admin");
    const { id } = await bill();
    await record(id);
    const expenses = await prisma.expense.count();

    const again = await record(id);

    expect(again.status).toBe(409);
    expect((await readError(again)).code).toBe("ALREADY_POSTED");
    expect(await prisma.expense.count()).toBe(expenses);
  });

  it("brings the month back if the expense is voided", async () => {
    signInAs("admin");
    const { id } = await bill();
    const expense = await readJson<Expense>(await record(id));
    expect(await due()).toEqual([]);

    const voided = await voidExpense(
      jsonRequest("POST", `/api/admin/expenses/${expense.id}/void`, { reason: "Wrong amount" }),
      routeParams({ id: expense.id }),
    );

    expect(voided.status).toBe(200);
    expect(await due()).toHaveLength(1);
    expect((await record(id)).status).toBe(201);
  });

  it("refuses a month that hasn't come round", async () => {
    signInAs("admin");
    const { id } = await bill();

    const response = await record(id, figures({ period: NEXT_MONTH }));

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ period: "billNotDue" });
  });

  it("refuses something that isn't a month, and a bad figure, with 400", async () => {
    signInAs("admin");
    const { id } = await bill();

    expect((await record(id, figures({ period: "soon" }))).status).toBe(400);
    expect((await record(id, figures({ amount: "" }))).status).toBe(400);
    expect(await due()).toHaveLength(1);
  });

  it("refuses a bill that's switched off, or doesn't exist", async () => {
    signInAs("admin");
    const { id } = await bill();
    await updateBill(
      jsonRequest("PUT", `/api/admin/recurring-bills/${id}`, { ...RENT, isActive: false }),
      routeParams({ id }),
    );

    expect((await record(id)).status).toBe(409);
    expect((await record("00000000-0000-0000-0000-000000000000")).status).toBe(404);
  });
});

describe("skipping a month", () => {
  it("stops asking about it, books nothing, and is on the record", async () => {
    signInAs("admin");
    const { id } = await bill();
    const [expenses, entries] = [await prisma.expense.count(), await prisma.journalEntry.count()];

    const response = await skip(id);

    expect(response.status).toBe(204);
    expect(await due()).toEqual([]);
    expect(await prisma.expense.count()).toBe(expenses);
    expect(await prisma.journalEntry.count()).toBe(entries);
    const log = await prisma.activityEntry.findFirst({ where: { entityId: id, action: "expense.recurringSkipped" } });
    expect(log?.changes).toEqual([{ field: "period", before: null, after: THIS_MONTH }]);
  });

  it("can't be followed by recording that month, or skipped twice", async () => {
    signInAs("admin");
    const { id } = await bill();
    await skip(id);

    expect((await record(id)).status).toBe(409);
    expect((await skip(id)).status).toBe(409);
  });

  it("refuses a month that hasn't come round", async () => {
    signInAs("admin");
    const { id } = await bill();

    expect((await skip(id, NEXT_MONTH)).status).toBe(400);
  });
});
