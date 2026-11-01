import { describe, expect, it, vi } from "vitest";

import { GetExpenseSummary, GetSupplierBalances } from "../ExpenseQueries";

import type { ExpenseSummary } from "../../../entities/Expense";
import type { IExpenseRepository } from "../../../repositories/IExpenseRepository";

const SUMMARY: ExpenseSummary = {
  owed: { count: 2, total: 21_120_000 },
  month: { fromDay: "2026-09-23", toDay: "2026-10-22", count: 7, total: 297_810_000 },
  counts: { unpaid: 2, paid: 5, void: 1 },
};

describe("GetExpenseSummary", () => {
  it("asks for the Persian month the cafe's today falls in", async () => {
    const summary = vi.fn<IExpenseRepository["summary"]>(async () => SUMMARY);
    const repo = { summary } as unknown as IExpenseRepository;

    // 13:30 in Tehran on 2026-10-20 — 28 Mehr 1405.
    const result = await new GetExpenseSummary(repo).execute(new Date("2026-10-20T10:00:00Z"));

    expect(summary).toHaveBeenCalledWith({ fromDay: "2026-09-23", toDay: "2026-10-22" });
    expect(result).toBe(SUMMARY);
  });

  it("moves to the next month once the cafe's day turns over", async () => {
    const summary = vi.fn<IExpenseRepository["summary"]>(async () => SUMMARY);
    const repo = { summary } as unknown as IExpenseRepository;

    // 00:30 in Tehran on 2026-10-23 — 1 Aban, though it's still the 22nd in UTC.
    await new GetExpenseSummary(repo).execute(new Date("2026-10-22T21:00:00Z"));

    expect(summary).toHaveBeenCalledWith({ fromDay: "2026-10-23", toDay: "2026-11-21" });
  });
});

describe("GetSupplierBalances", () => {
  const balancesOf = (rows: Awaited<ReturnType<IExpenseRepository["owedBySupplier"]>>) =>
    new GetSupplierBalances({
      owedBySupplier: vi.fn(async () => rows),
    } as unknown as IExpenseRepository).execute();

  it("keeps bills with no supplier apart, and totals everything owed", async () => {
    await expect(
      balancesOf([
        { supplierId: "sup1", billCount: 2, owed: 700_000 },
        { billCount: 1, owed: 250_000 },
        { supplierId: "sup2", billCount: 1, owed: 50_000 },
      ]),
    ).resolves.toEqual({
      suppliers: [
        { supplierId: "sup1", billCount: 2, owed: 700_000 },
        { supplierId: "sup2", billCount: 1, owed: 50_000 },
      ],
      noSupplier: { billCount: 1, owed: 250_000 },
      total: 1_000_000,
    });
  });

  it("owes nothing when nothing's unpaid", async () => {
    await expect(balancesOf([])).resolves.toEqual({
      suppliers: [],
      noSupplier: { billCount: 0, owed: 0 },
      total: 0,
    });
  });
});
