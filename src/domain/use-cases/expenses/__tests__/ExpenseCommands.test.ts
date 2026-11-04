import { describe, expect, it, vi } from "vitest";

import { SYSTEM_ACCOUNTS } from "../../../entities/Ledger";
import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import {
  PayExpense,
  RecordExpense,
  SaveSupplier,
  SetExpenseReceipt,
  VoidExpense,
  type RecordExpenseInput,
} from "../ExpenseCommands";

import type { Expense, Supplier } from "../../../entities/Expense";
import type { Account, JournalEntry } from "../../../entities/Ledger";
import type { IExpenseRepository } from "../../../repositories/IExpenseRepository";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";

const ACTOR = { id: "owner", name: "Rira" };
/** 13:30 in Tehran on 2026-10-20. */
const NOW = new Date("2026-10-20T10:00:00Z");
const SETTINGS = { vatRateBps: 1000 };
const RECEIPT = "/uploads/receipts/0f8fad5b-d9cb-469f-a165-70867728950e.jpg";
const OTHER_RECEIPT = "/uploads/receipts/7c9e6679-7425-40de-944b-e07fc1f90ae7.png";

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "x1",
    number: 14,
    date: "2026-10-10",
    supplierName: "Power Co",
    accountCode: "6300",
    description: "Electricity",
    amount: 1_100_000,
    vatAmount: 100_000,
    status: "unpaid",
    paidAmount: 0,
    createdById: ACTOR.id,
    createdByName: ACTOR.name,
    createdAt: "",
    ...overrides,
  };
}

const UTILITIES: Account = {
  code: "6300",
  name: "Utilities",
  nameFa: "",
  type: "expense",
  isSystem: false,
  isActive: true,
};

type ExpensesFake = {
  repo: IExpenseRepository;
  create: ReturnType<typeof vi.fn<IExpenseRepository["create"]>>;
  pay: ReturnType<typeof vi.fn<IExpenseRepository["pay"]>>;
  voidExpense: ReturnType<typeof vi.fn<IExpenseRepository["void"]>>;
  setReceipt: ReturnType<typeof vi.fn<IExpenseRepository["setReceipt"]>>;
  createSupplier: ReturnType<typeof vi.fn<IExpenseRepository["createSupplier"]>>;
  updateSupplier: ReturnType<typeof vi.fn<IExpenseRepository["updateSupplier"]>>;
};

function expensesWith(current: Expense | null): ExpensesFake {
  const supplier = (input: Partial<Supplier>): Supplier => ({
    id: "sup1",
    name: "",
    isActive: true,
    createdAt: "",
    ...input,
  });
  const create = vi.fn<IExpenseRepository["create"]>(async (input) =>
    expense({ ...input, status: input.paidFrom ? "paid" : "unpaid" }),
  );
  const pay = vi.fn<IExpenseRepository["pay"]>(async (_id, payment) => {
    const paidAmount = payment.expectedPaid + payment.amount;
    const settled = paidAmount >= (current?.amount ?? 0);
    return expense({
      ...current,
      paidAmount,
      ...(settled ? { status: "paid", paidFrom: payment.source, paidOn: payment.paidOn } : {}),
    });
  });
  const voidExpense = vi.fn<IExpenseRepository["void"]>(async () => expense({ status: "void" }));
  const setReceipt = vi.fn<IExpenseRepository["setReceipt"]>(async (_id, receiptUrl) =>
    expense({ ...current, receiptUrl }),
  );
  const createSupplier = vi.fn<IExpenseRepository["createSupplier"]>(async (input) => supplier(input));
  const updateSupplier = vi.fn<IExpenseRepository["updateSupplier"]>(async (id, input) => supplier({ ...input, id }));
  const repo = {
    getExpense: vi.fn(async () => current),
    create,
    pay,
    void: voidExpense,
    setReceipt,
    createSupplier,
    updateSupplier,
  } as unknown as IExpenseRepository;
  return { repo, create, pay, voidExpense, setReceipt, createSupplier, updateSupplier };
}

function ledgerWith(account: Account | null): ILedgerRepository {
  return { getAccount: vi.fn(async () => account) } as unknown as ILedgerRepository;
}

describe("RecordExpense", () => {
  const INPUT: RecordExpenseInput = {
    date: "2026-10-20",
    supplierId: "sup1",
    accountCode: "6300",
    description: "  Electricity  ",
    amount: 1_100_000,
    vatAmount: 100_000,
  };

  it("records the bill under the actor, posting it to payables and auditing the amount", async () => {
    const { repo, create } = expensesWith(null);
    await new RecordExpense(repo, ledgerWith(UTILITIES)).execute(INPUT, ACTOR, NOW);

    const [sent, ledgerHook, audit] = create.mock.calls[0];
    expect(sent).toEqual({
      date: "2026-10-20",
      supplierId: "sup1",
      accountCode: "6300",
      description: "Electricity",
      amount: 1_100_000,
      vatAmount: 100_000,
      paidFrom: undefined,
      createdById: "owner",
      createdByName: "Rira",
    });

    const [journal] = ledgerHook(expense(), SETTINGS);
    expect(journal.lines).toEqual([
      { accountCode: "6300", debit: 1_000_000, credit: 0, memo: "Power Co" },
      { accountCode: SYSTEM_ACCOUNTS.vatPayable, debit: 100_000, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.accountsPayable, debit: 0, credit: 1_100_000 },
    ]);
    // Paid on the spot, the money comes out of the till instead.
    expect(ledgerHook(expense({ status: "paid", paidFrom: "cash" }), SETTINGS)[0].lines[2].accountCode).toBe(
      SYSTEM_ACCOUNTS.cash,
    );

    expect(audit?.(expense())).toEqual({
      actorId: "owner",
      actorName: "Rira",
      action: "expense.recorded",
      entityType: "expense",
      entityId: "x1",
      entityLabel: "EX-14 Electricity",
      changes: [{ field: "amount", before: null, after: "1100000" }],
    });
  });

  it("allows equipment, which is an asset but not a money account", async () => {
    const { repo, create } = expensesWith(null);
    const equipment: Account = { ...UTILITIES, code: "1500", type: "asset" };
    await new RecordExpense(repo, ledgerWith(equipment)).execute(
      { ...INPUT, accountCode: "1500", paidFrom: "bank" },
      ACTOR,
      NOW,
    );
    expect(create.mock.calls[0][0].paidFrom).toBe("bank");
  });

  it("keeps a receipt uploaded with the expense", async () => {
    const { repo, create } = expensesWith(null);
    await new RecordExpense(repo, ledgerWith(UTILITIES)).execute({ ...INPUT, receiptUrl: RECEIPT }, ACTOR, NOW);
    expect(create.mock.calls[0][0].receiptUrl).toBe(RECEIPT);
  });

  it.each<[string, Partial<RecordExpenseInput>, string]>([
    ["a receipt stored somewhere else", { receiptUrl: "https://example.com/receipt.jpg" }, "receiptUrl"],
    ["a future date", { date: "2026-10-21" }, "date"],
    ["a blank description", { description: "  " }, "description"],
    ["an overlong description", { description: "x".repeat(301) }, "description"],
    ["a zero amount", { amount: 0 }, "amount"],
    ["a fractional amount", { amount: 10.5 }, "amount"],
    ["negative VAT", { vatAmount: -1 }, "vatAmount"],
    ["VAT equal to the total", { vatAmount: 1_100_000 }, "vatAmount"],
    ["fractional VAT", { vatAmount: 0.5 }, "vatAmount"],
  ])("refuses %s before touching the ledger", async (_label, overrides, field) => {
    const { repo, create } = expensesWith(null);
    const ledger = ledgerWith(UTILITIES);
    await expect(new RecordExpense(repo, ledger).execute({ ...INPUT, ...overrides }, ACTOR, NOW)).rejects.toMatchObject(
      { field },
    );
    expect(ledger.getAccount).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each<[string, Account | null]>([
    ["an unknown account", null],
    ["an inactive account", { ...UTILITIES, isActive: false }],
    ["a revenue account", { ...UTILITIES, code: "4100", type: "revenue" }],
  ])("refuses %s", async (_label, account) => {
    const { repo, create } = expensesWith(null);
    await expect(new RecordExpense(repo, ledgerWith(account)).execute(INPUT, ACTOR, NOW)).rejects.toMatchObject({
      field: "accountCode",
    });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("PayExpense", () => {
  it("pays an owed bill and books the money out of the chosen account", async () => {
    const { repo, pay } = expensesWith(expense());
    const paid = await new PayExpense(repo).execute("x1", { source: "bank", paidOn: "2026-10-15" }, ACTOR, NOW);
    expect(paid.status).toBe("paid");

    const [id, payment, ledgerHook, audit] = pay.mock.calls[0];
    expect(id).toBe("x1");
    expect(payment).toEqual({ amount: 1_100_000, source: "bank", paidOn: "2026-10-15", expectedPaid: 0 });
    const [journal] = ledgerHook(paid, SETTINGS);
    expect(journal).toMatchObject({
      date: "2026-10-15",
      source: "expensePayment",
      uniqueKey: "expense:x1:payment:1100000",
    });
    expect(journal.lines).toEqual([
      { accountCode: SYSTEM_ACCOUNTS.accountsPayable, debit: 1_100_000, credit: 0, memo: "Power Co" },
      { accountCode: SYSTEM_ACCOUNTS.bank, debit: 0, credit: 1_100_000 },
    ]);
    expect(audit?.(paid)).toMatchObject({
      action: "expense.paid",
      changes: [{ field: "paidAmount", before: "0", after: "1100000" }],
    });
  });

  it("pays part of a bill, leaves the rest owed, and keys each payment apart", async () => {
    const { repo, pay } = expensesWith(expense());
    const part = await new PayExpense(repo).execute(
      "x1",
      { source: "cash", paidOn: "2026-10-15", amount: 400_000 },
      ACTOR,
      NOW,
    );

    expect(part).toMatchObject({ status: "unpaid", paidAmount: 400_000 });
    const [, payment, ledgerHook] = pay.mock.calls[0];
    expect(payment).toMatchObject({ amount: 400_000, expectedPaid: 0 });
    const [journal] = ledgerHook(part, SETTINGS);
    expect(journal.uniqueKey).toBe("expense:x1:payment:400000");
    expect(journal.lines).toEqual([
      { accountCode: SYSTEM_ACCOUNTS.accountsPayable, debit: 400_000, credit: 0, memo: "Power Co" },
      { accountCode: SYSTEM_ACCOUNTS.cash, debit: 0, credit: 400_000 },
    ]);
  });

  it("pays what's left when no amount is given, and refuses more than that", async () => {
    const { repo, pay } = expensesWith(expense({ paidAmount: 1_000_000 }));
    await expect(
      new PayExpense(repo).execute("x1", { source: "cash", paidOn: "2026-10-15", amount: 100_001 }, ACTOR, NOW),
    ).rejects.toThrow("paymentOverOwed");

    const paid = await new PayExpense(repo).execute("x1", { source: "cash", paidOn: "2026-10-15" }, ACTOR, NOW);
    expect(pay.mock.calls[0][1]).toMatchObject({ amount: 100_000, expectedPaid: 1_000_000 });
    expect(paid).toMatchObject({ status: "paid", paidFrom: "cash", paidAmount: 1_100_000 });
  });

  it("refuses an unknown expense", async () => {
    await expect(
      new PayExpense(expensesWith(null).repo).execute("x1", { source: "cash", paidOn: "2026-10-15" }, ACTOR, NOW),
    ).rejects.toThrow(NotFoundError);
  });

  it.each(["paid", "void"] as const)("refuses an expense that's already %s", async (status) => {
    const { repo, pay } = expensesWith(expense({ status }));
    await expect(
      new PayExpense(repo).execute("x1", { source: "cash", paidOn: "2026-10-15" }, ACTOR, NOW),
    ).rejects.toThrow(ConflictError);
    expect(pay).not.toHaveBeenCalled();
  });

  it("refuses paying in the future or before the bill was incurred", async () => {
    const { repo, pay } = expensesWith(expense({ date: "2026-10-10" }));
    await expect(
      new PayExpense(repo).execute("x1", { source: "cash", paidOn: "2026-10-21" }, ACTOR, NOW),
    ).rejects.toThrow(ValidationError);
    await expect(
      new PayExpense(repo).execute("x1", { source: "cash", paidOn: "2026-10-09" }, ACTOR, NOW),
    ).rejects.toThrow("before it was incurred");
    expect(pay).not.toHaveBeenCalled();
  });
});

describe("VoidExpense", () => {
  const ORIGINAL: JournalEntry = {
    id: "e1",
    number: 7,
    date: "2026-10-10",
    description: "EX-14",
    source: "expense",
    sourceId: "x1",
    lines: [
      { accountCode: "6300", debit: 100, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.accountsPayable, debit: 0, credit: 100 },
    ],
    createdById: "owner",
    createdByName: "Rira",
    createdAt: "",
  };

  it("reverses every entry today, with the reason, and audits the status it had", async () => {
    const { repo, voidExpense } = expensesWith(expense({ status: "paid" }));
    await new VoidExpense(repo).execute("x1", "  duplicate  ", ACTOR, NOW);

    const [id, reverse, audit] = voidExpense.mock.calls[0];
    expect(id).toBe("x1");
    expect(reverse(ORIGINAL)).toMatchObject({
      date: "2026-10-20",
      description: "Reversal of JE-7: duplicate",
      source: "reversal",
      sourceId: "x1",
      reversesId: "e1",
      lines: [
        { accountCode: "6300", debit: 0, credit: 100 },
        { accountCode: SYSTEM_ACCOUNTS.accountsPayable, debit: 100, credit: 0 },
      ],
    });
    expect(audit?.(expense({ status: "void" }))).toMatchObject({
      action: "expense.voided",
      changes: [{ field: "status", before: "paid", after: "void" }],
    });
  });

  it("falls back to a default reason", async () => {
    const { repo, voidExpense } = expensesWith(expense());
    await new VoidExpense(repo).execute("x1", "   ", ACTOR, NOW);
    expect(voidExpense.mock.calls[0][1](ORIGINAL).description).toBe("Reversal of JE-7: EX-14 voided");
  });

  it("refuses an unknown expense and one already void", async () => {
    await expect(new VoidExpense(expensesWith(null).repo).execute("x1", "x", ACTOR, NOW)).rejects.toThrow(
      NotFoundError,
    );
    const { repo, voidExpense } = expensesWith(expense({ status: "void" }));
    await expect(new VoidExpense(repo).execute("x1", "x", ACTOR, NOW)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    expect(voidExpense).not.toHaveBeenCalled();
  });
});

describe("SetExpenseReceipt", () => {
  it("attaches a receipt and audits the change without posting anything", async () => {
    const { repo, setReceipt } = expensesWith(expense({ status: "paid" }));
    const updated = await new SetExpenseReceipt(repo).execute("x1", RECEIPT, ACTOR);

    expect(updated.receiptUrl).toBe(RECEIPT);
    const [id, receiptUrl, audit] = setReceipt.mock.calls[0];
    expect([id, receiptUrl]).toEqual(["x1", RECEIPT]);
    expect(audit?.(updated)).toMatchObject({
      action: "expense.receiptChanged",
      entityLabel: "EX-14 Electricity",
      changes: [{ field: "receiptUrl", before: null, after: RECEIPT }],
    });
  });

  it("records what a replaced receipt was, and what removing one took off", async () => {
    const replacing = expensesWith(expense({ receiptUrl: RECEIPT }));
    const replaced = await new SetExpenseReceipt(replacing.repo).execute("x1", OTHER_RECEIPT, ACTOR);
    expect(replacing.setReceipt.mock.calls[0][2]?.(replaced)?.changes).toEqual([
      { field: "receiptUrl", before: RECEIPT, after: OTHER_RECEIPT },
    ]);

    const removing = expensesWith(expense({ receiptUrl: RECEIPT }));
    const removed = await new SetExpenseReceipt(removing.repo).execute("x1", undefined, ACTOR);
    expect(removing.setReceipt.mock.calls[0][2]?.(removed)?.changes).toEqual([
      { field: "receiptUrl", before: RECEIPT, after: null },
    ]);
  });

  it("does nothing when the receipt is already the one attached", async () => {
    const { repo, setReceipt } = expensesWith(expense({ receiptUrl: RECEIPT }));
    await expect(new SetExpenseReceipt(repo).execute("x1", RECEIPT, ACTOR)).resolves.toMatchObject({
      receiptUrl: RECEIPT,
    });
    expect(setReceipt).not.toHaveBeenCalled();
  });

  it("refuses an unknown expense, a void one and a URL it didn't store", async () => {
    await expect(new SetExpenseReceipt(expensesWith(null).repo).execute("x1", RECEIPT, ACTOR)).rejects.toThrow(
      NotFoundError,
    );

    const voided = expensesWith(expense({ status: "void" }));
    await expect(new SetExpenseReceipt(voided.repo).execute("x1", RECEIPT, ACTOR)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    expect(voided.setReceipt).not.toHaveBeenCalled();

    const { repo, setReceipt } = expensesWith(expense());
    await expect(new SetExpenseReceipt(repo).execute("x1", "/uploads/products/a.png", ACTOR)).rejects.toMatchObject({
      field: "receiptUrl",
    });
    expect(setReceipt).not.toHaveBeenCalled();
  });
});

describe("SaveSupplier", () => {
  const ACTOR = { id: "a1", name: "Admin" };
  const existing = { id: "sup1", name: "Power Co", isActive: true, createdAt: "2026-01-01T00:00:00.000Z" };
  const withSupplier = (repo: IExpenseRepository): IExpenseRepository =>
    Object.assign(repo, { getSupplier: vi.fn(async () => existing) });

  it("trims the fields and drops blank optional ones", async () => {
    const { repo, createSupplier, updateSupplier } = expensesWith(null);
    await new SaveSupplier(withSupplier(repo)).create({ name: "  Power Co ", phone: "  ", note: " monthly " }, ACTOR);
    expect(createSupplier).toHaveBeenCalledWith(
      { name: "Power Co", phone: undefined, note: "monthly" },
      expect.any(Function),
    );

    await new SaveSupplier(withSupplier(repo)).update(
      "sup1",
      { name: "Power Co", phone: " 021 ", isActive: false },
      ACTOR,
    );
    expect(updateSupplier).toHaveBeenCalledWith(
      "sup1",
      { name: "Power Co", phone: "021", note: undefined, isActive: false },
      expect.any(Function),
    );
  });

  it("records the supplier as created, and only the fields an edit moved", async () => {
    const { repo, createSupplier, updateSupplier } = expensesWith(null);
    const saver = new SaveSupplier(withSupplier(repo));
    await saver.create({ name: "Power Co" }, ACTOR);
    const created = createSupplier.mock.calls[0][1]?.({ ...existing });
    expect(created).toMatchObject({
      action: "expense.supplierCreated",
      entityType: "expense",
      entityLabel: "Power Co",
    });

    await saver.update("sup1", { name: "Power Co", phone: "021", isActive: false }, ACTOR);
    const audit = updateSupplier.mock.calls[0][2];
    expect(audit?.({ ...existing, phone: "021", isActive: false })).toMatchObject({
      action: "expense.supplierUpdated",
      changes: [
        { field: "phone", before: null, after: "021" },
        { field: "isActive", before: "true", after: "false" },
      ],
    });
    // A save that moved nothing records nothing.
    expect(audit?.({ ...existing })).toBeNull();
  });

  it("refuses a supplier without a name", async () => {
    const { repo, createSupplier, updateSupplier } = expensesWith(null);
    await expect(new SaveSupplier(withSupplier(repo)).create({ name: "   " }, ACTOR)).rejects.toMatchObject({
      field: "name",
    });
    await expect(
      new SaveSupplier(withSupplier(repo)).update("sup1", { name: "", isActive: true }, ACTOR),
    ).rejects.toThrow(ValidationError);
    expect(createSupplier).not.toHaveBeenCalled();
    expect(updateSupplier).not.toHaveBeenCalled();
  });
});
