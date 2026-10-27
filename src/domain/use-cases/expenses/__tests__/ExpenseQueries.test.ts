import { describe, expect, it, vi } from "vitest";

import { GetExpenseSummary } from "../ExpenseQueries";

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
