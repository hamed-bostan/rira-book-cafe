import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import {
  ListDueBills,
  RecordRecurringBill,
  SaveRecurringBill,
  SkipRecurringBill,
  type RecurringBillInput,
} from "../RecurringBills";

import type { Expense } from "../../../entities/Expense";
import type { Account } from "../../../entities/Ledger";
import type { RecurringBill } from "../../../entities/RecurringBill";
import type { IExpenseRepository } from "../../../repositories/IExpenseRepository";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";
import type { IRecurringBillRepository } from "../../../repositories/IRecurringBillRepository";

const ACTOR = { id: "owner", name: "Rira" };
/** 2026-10-23 is 1 Aban 1405. */
const NOW = new Date("2026-10-23T10:00:00Z");

const BILL: RecurringBill = {
  id: "b1",
  description: "Rent",
  accountCode: "6100",
  amount: 30_000_000,
  vatAmount: 0,
  dayOfMonth: 1,
  startsOn: "2026-10-23",
  isActive: true,
  createdAt: "",
};

const INPUT: RecurringBillInput = {
  description: "  Rent  ",
  accountCode: "6100",
  supplierId: undefined,
  amount: 30_000_000,
  vatAmount: 0,
  dayOfMonth: 1,
};

const RENT: Account = { code: "6100", name: "Rent", nameFa: "", type: "expense", isSystem: false, isActive: true };

function billsWith(bill: RecurringBill | null, running: { bill: RecurringBill; done: string[] }[] = []) {
  const create = vi.fn<IRecurringBillRepository["create"]>(async (input) => ({ ...BILL, ...input }));
  const update = vi.fn<IRecurringBillRepository["update"]>(async (_id, input) => ({ ...BILL, ...input }));
  const skip = vi.fn<IRecurringBillRepository["skip"]>(async () => undefined);
  const repo = {
    get: vi.fn(async () => bill),
    listActiveWithDone: vi.fn(async () => running),
    create,
    update,
    skip,
  } as unknown as IRecurringBillRepository;
  return { repo, create, update, skip };
}

const ledgerWith = (account: Account | null): ILedgerRepository =>
  ({ getAccount: vi.fn(async () => account) }) as unknown as ILedgerRepository;

describe("SaveRecurringBill", () => {
  it("sets a bill up from today, books nothing, and logs it", async () => {
    const { repo, create } = billsWith(null);
    await new SaveRecurringBill(repo, ledgerWith(RENT)).create(INPUT, ACTOR, NOW);

    const [sent, audit] = create.mock.calls[0];
    expect(sent).toMatchObject({ description: "Rent", startsOn: "2026-10-23", dayOfMonth: 1 });
    expect(audit?.(BILL)).toMatchObject({
      action: "expense.recurringChanged",
      entityLabel: "Rent",
      changes: [{ field: "amount", before: null, after: "30000000" }],
    });
  });

  it.each<[string, Partial<RecurringBillInput>, string]>([
    ["a blank description", { description: "  " }, "description"],
    ["a zero amount", { amount: 0 }, "amount"],
    ["VAT equal to the total", { vatAmount: 30_000_000 }, "vatAmount"],
    ["day zero", { dayOfMonth: 0 }, "dayOfMonth"],
    ["day 32", { dayOfMonth: 32 }, "dayOfMonth"],
    ["half a day", { dayOfMonth: 1.5 }, "dayOfMonth"],
  ])("refuses %s", async (_label, overrides, field) => {
    const { repo, create } = billsWith(null);
    await expect(
      new SaveRecurringBill(repo, ledgerWith(RENT)).create({ ...INPUT, ...overrides }, ACTOR, NOW),
    ).rejects.toMatchObject({ field });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses an account an expense can't be booked to", async () => {
    const { repo, create } = billsWith(null);
    const revenue: Account = { ...RENT, code: "4100", type: "revenue" };
    await expect(new SaveRecurringBill(repo, ledgerWith(revenue)).create(INPUT, ACTOR, NOW)).rejects.toMatchObject({
      field: "accountCode",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("logs only what moved when a bill is edited", async () => {
    const { repo, update } = billsWith(BILL);
    const edited = { ...INPUT, amount: 32_000_000, isActive: true };
    await new SaveRecurringBill(repo, ledgerWith(RENT)).update("b1", edited, ACTOR);

    const audit = update.mock.calls[0][2];
    expect(audit?.({ ...BILL, amount: 32_000_000 })).toMatchObject({
      changes: [{ field: "amount", before: "30000000", after: "32000000" }],
    });
    expect(audit?.(BILL)).toBeNull();
  });

  it("refuses to edit a bill that doesn't exist", async () => {
    await expect(
      new SaveRecurringBill(billsWith(null).repo, ledgerWith(RENT)).update("b1", { ...INPUT, isActive: true }, ACTOR),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("ListDueBills", () => {
  it("lists what's waiting across every bill, oldest first", async () => {
    const internet = { ...BILL, id: "b2", description: "Internet", dayOfMonth: 1, startsOn: "2026-09-23" };
    const { repo } = billsWith(null, [
      { bill: BILL, done: [] },
      { bill: internet, done: [] },
    ]);

    const due = await new ListDueBills(repo).execute(NOW);

    expect(due.map((item) => `${item.bill.description} ${item.period}`)).toEqual([
      "Internet 1405-07",
      "Internet 1405-08",
      "Rent 1405-08",
    ]);
  });
});

describe("RecordRecurringBill", () => {
  const FIGURES = {
    date: "2026-10-23",
    accountCode: "6100",
    description: "Rent · Aban",
    amount: 31_000_000,
    vatAmount: 0,
  };

  function expenses() {
    const create = vi.fn<IExpenseRepository["create"]>(async () => ({ id: "x1" }) as Expense);
    return { repo: { create } as unknown as IExpenseRepository, create };
  }

  it("books the figures as they came, as an ordinary expense that claims the month", async () => {
    const { repo: bills } = billsWith(BILL);
    const { repo, create } = expenses();

    await new RecordRecurringBill(bills, repo, ledgerWith(RENT)).execute("b1", "1405-08", FIGURES, ACTOR, NOW);

    expect(create.mock.calls[0][0]).toMatchObject({
      amount: 31_000_000,
      description: "Rent · Aban",
      recurring: { billId: "b1", period: "1405-08" },
    });
  });

  it("refuses a bill that doesn't exist, is switched off, or isn't due that month", async () => {
    const { repo, create } = expenses();
    const record = (bill: RecurringBill | null, period: string) =>
      new RecordRecurringBill(billsWith(bill).repo, repo, ledgerWith(RENT)).execute("b1", period, FIGURES, ACTOR, NOW);

    await expect(record(null, "1405-08")).rejects.toThrow(NotFoundError);
    await expect(record({ ...BILL, isActive: false }, "1405-08")).rejects.toThrow(ConflictError);
    await expect(record(BILL, "1405-09")).rejects.toMatchObject({ field: "period" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("SkipRecurringBill", () => {
  it("marks the month dealt with and logs it", async () => {
    const { repo, skip } = billsWith(BILL);

    await new SkipRecurringBill(repo).execute("b1", "1405-08", ACTOR, NOW);

    const [bill, period, actor, audit] = skip.mock.calls[0];
    expect([bill.id, period, actor]).toEqual(["b1", "1405-08", ACTOR]);
    expect(audit?.(BILL)).toMatchObject({
      action: "expense.recurringSkipped",
      changes: [{ field: "period", before: null, after: "1405-08" }],
    });
  });

  it("refuses a month that isn't due", async () => {
    const { repo, skip } = billsWith(BILL);
    await expect(new SkipRecurringBill(repo).execute("b1", "1405-09", ACTOR, NOW)).rejects.toMatchObject({
      field: "period",
    });
    expect(skip).not.toHaveBeenCalled();
  });
});
