import { describe, expect, it, vi } from "vitest";

import { accountingSettingsSchema, manualEntrySchema } from "@/src/contracts/accounting-schema";
import { expenseSchema } from "@/src/contracts/expense-schema";

import { isExpenseTarget } from "../../../entities/Expense";
import { typeForCode } from "../../../entities/Ledger";
import { ConflictError } from "../../../errors/ConflictError";
import { ValidationError } from "../../../errors/ValidationError";
import { RecordExpense } from "../../expenses/ExpenseCommands";
import { CreateLedgerAccount, PostManualEntry, ReverseJournalEntry, UpdateAccountingSettings } from "../LedgerCommands";

import type { JournalEntry } from "../../../entities/Ledger";
import type { IExpenseRepository } from "../../../repositories/IExpenseRepository";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";

const ACTOR = { id: "owner", name: "Rira" };
const NOW = new Date("2026-10-16T08:00:00Z");

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "e1",
    number: 5,
    date: "2026-10-10",
    description: "Capital",
    source: "manual",
    lines: [
      { accountCode: "1120", debit: 100, credit: 0 },
      { accountCode: "3100", debit: 0, credit: 100 },
    ],
    createdById: "owner",
    createdByName: "Rira",
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("manual entries", () => {
  it("refuses a future date before touching the ledger", async () => {
    const ledger = { post: vi.fn() } as unknown as ILedgerRepository;
    await expect(
      new PostManualEntry(ledger).execute({ date: "2026-10-17", description: "x", lines: entry().lines }, ACTOR, NOW),
    ).rejects.toThrow(ValidationError);
    expect(ledger.post).not.toHaveBeenCalled();
  });

  it("only reverses manual entries, and not into the past", async () => {
    const reverse = vi.fn(async () => entry({ id: "e2", number: 6, reversesId: "e1" }));
    const ledgerWith = (found: JournalEntry) =>
      ({ getEntry: vi.fn(async () => found), reverse }) as unknown as ILedgerRepository;

    await expect(
      new ReverseJournalEntry(ledgerWith(entry({ source: "orderSale" }))).execute("e1", "2026-10-16", "x", ACTOR, NOW),
    ).rejects.toThrow(ConflictError);
    await expect(
      new ReverseJournalEntry(ledgerWith(entry())).execute("e1", "2026-10-09", "x", ACTOR, NOW),
    ).rejects.toThrow(ValidationError);
    await new ReverseJournalEntry(ledgerWith(entry())).execute("e1", "2026-10-16", "typo", ACTOR, NOW);
    expect(reverse).toHaveBeenCalledOnce();
  });

  it("the contract flags a two-sided line and an unbalanced entry", () => {
    const result = manualEntrySchema.safeParse({
      date: "2026-10-16",
      description: "VAT paid",
      lines: [
        { accountCode: "2200", debit: "100", credit: "100", memo: "" },
        { accountCode: "1120", debit: "", credit: "90", memo: "" },
      ],
    });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining(["lineOneSide", "entryUnbalanced"]));
  });
});

describe("chart of accounts and settings", () => {
  it("ties the code's first digit to the account type", async () => {
    expect(typeForCode("1300")).toBe("asset");
    expect(typeForCode("6800")).toBe("expense");
    const ledger = { createAccount: vi.fn() } as unknown as ILedgerRepository;
    await expect(
      new CreateLedgerAccount(ledger).execute(
        { code: "6800", name: "Laundry", nameFa: "لباسشویی", type: "revenue" },
        ACTOR,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("parses a VAT percentage to basis points and refuses closing the future", async () => {
    expect(accountingSettingsSchema.parse({ vatRate: "9.5", booksClosedThrough: "" })).toEqual({
      vatRate: 950,
      booksClosedThrough: undefined,
    });
    const ledger = { getSettings: vi.fn(), updateSettings: vi.fn() } as unknown as ILedgerRepository;
    await expect(
      new UpdateAccountingSettings(ledger).execute({ vatRateBps: 1000, booksClosedThrough: "2026-10-20" }, ACTOR, NOW),
    ).rejects.toThrow(ValidationError);
  });
});

describe("expenses", () => {
  it("books to expense or equipment — never to money accounts or inventory", () => {
    expect(isExpenseTarget({ code: "6100", type: "expense" })).toBe(true);
    expect(isExpenseTarget({ code: "1200", type: "asset" })).toBe(false);
    expect(isExpenseTarget({ code: "1500", type: "asset" })).toBe(true);
    expect(isExpenseTarget({ code: "1110", type: "asset" })).toBe(false);
    expect(isExpenseTarget({ code: "2100", type: "liability" })).toBe(false);
  });

  it("the contract turns the payment choice into a source and caps VAT below the total", () => {
    const base = {
      date: "2026-10-16",
      supplierId: "",
      accountCode: "6300",
      description: "Electricity",
      amount: "1100000",
      vatAmount: "100000",
    };
    expect(expenseSchema.parse({ ...base, payment: "bank" })).toMatchObject({
      paidFrom: "bank",
      supplierId: undefined,
      amount: 1_100_000,
    });
    expect(expenseSchema.parse({ ...base, payment: "unpaid" }).paidFrom).toBeUndefined();
    expect(expenseSchema.safeParse({ ...base, vatAmount: "1100000", payment: "cash" }).success).toBe(false);
  });

  it("refuses an inactive or non-expense account", async () => {
    const expenses = { create: vi.fn() } as unknown as IExpenseRepository;
    const ledger = {
      getAccount: vi.fn(async () => ({
        code: "1110",
        name: "Cash",
        nameFa: "صندوق",
        type: "asset",
        isSystem: true,
        isActive: true,
      })),
    } as unknown as ILedgerRepository;
    await expect(
      new RecordExpense(expenses, ledger).execute(
        { date: "2026-10-16", accountCode: "1110", description: "x", amount: 100, vatAmount: 0 },
        ACTOR,
        NOW,
      ),
    ).rejects.toThrow(ValidationError);
    expect(expenses.create).not.toHaveBeenCalled();
  });
});
