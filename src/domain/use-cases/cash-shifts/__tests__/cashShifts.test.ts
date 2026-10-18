import { describe, expect, it, vi } from "vitest";

import { assertBalanced, DEFAULT_VAT_RATE_BPS, SYSTEM_ACCOUNTS } from "../../../entities/Ledger";
import { cashOverShortEntry } from "../../../entities/Postings";
import { ConflictError } from "../../../errors/ConflictError";
import { ValidationError } from "../../../errors/ValidationError";
import { CloseCashShift, GetCurrentCashShift, OpenCashShift } from "../CashShiftCommands";

import type { CashShift } from "../../../entities/CashShift";
import type { ICashShiftRepository } from "../../../repositories/ICashShiftRepository";

const NOW = new Date("2026-10-20T18:00:00Z");
const STAFF = { id: "s1", name: "Ali" };

function shift(overrides: Partial<CashShift> = {}): CashShift {
  return {
    id: "z1",
    number: 12,
    status: "open",
    openedAt: "2026-10-20T08:00:00Z",
    openedById: "s1",
    openedByName: "Ali",
    openingFloat: 500_000,
    ...overrides,
  };
}

function repo(current: CashShift | null) {
  return {
    getOpen: vi.fn(async () => (current?.status === "open" ? current : null)),
    getById: vi.fn(async () => current),
    list: vi.fn(async () => []),
    open: vi.fn(async () => shift()),
    movements: vi.fn(async () => ({ cash: 1_200_000, bank: 800_000, online: 300_000, payments: 9 })),
    close: vi.fn(async () => shift({ status: "closed" })),
  } satisfies ICashShiftRepository;
}

describe("cashOverShortEntry", () => {
  it("books a shortage against cash over/short, and an overage the other way, balanced", () => {
    const short = cashOverShortEntry(shift({ difference: -20_000 }), "2026-10-20", STAFF);
    expect(short?.lines).toEqual([
      { accountCode: SYSTEM_ACCOUNTS.cashOverShort, debit: 20_000, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.cash, debit: 0, credit: 20_000 },
    ]);
    expect(() => assertBalanced(short!)).not.toThrow();

    const over = cashOverShortEntry(shift({ difference: 5_000 }), "2026-10-20", STAFF);
    expect(over?.lines[0]).toEqual({ accountCode: SYSTEM_ACCOUNTS.cash, debit: 5_000, credit: 0 });
    expect(over?.uniqueKey).toBe("cashShift:z1");
  });

  it("books nothing for an exact count", () => {
    expect(cashOverShortEntry(shift({ difference: 0 }), "2026-10-20", STAFF)).toBeNull();
  });
});

describe("cash shifts", () => {
  it("opens one shift at a time", async () => {
    await expect(new OpenCashShift(repo(shift())).execute({ openingFloat: 100 }, STAFF)).rejects.toMatchObject({
      code: "SHIFT_ALREADY_OPEN",
    });
    const free = repo(null);
    await new OpenCashShift(free).execute({ openingFloat: 250_000, note: "  " }, STAFF);
    expect(free.open).toHaveBeenCalledWith({ openingFloat: 250_000, note: undefined, by: STAFF });
  });

  it("refuses a float that isn't whole Toman", async () => {
    await expect(new OpenCashShift(repo(null)).execute({ openingFloat: -1 }, STAFF)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("reports what the drawer should hold: the float plus the cash that moved", async () => {
    const report = await new GetCurrentCashShift(repo(shift())).execute(NOW);
    expect(report?.expectedCash).toBe(1_700_000);
    expect(report?.movements.bank).toBe(800_000);
  });

  it("closes with a ledger hook that posts the over/short of the closed shift", async () => {
    const shifts = repo(shift());
    await new CloseCashShift(shifts).execute("z1", { countedCash: 1_690_000 }, STAFF, NOW);
    const [, input, hook] = shifts.close.mock.calls[0] as unknown as [
      string,
      { countedCash: number },
      (s: CashShift, settings: { vatRateBps: number }) => unknown[],
    ];
    expect(input.countedCash).toBe(1_690_000);
    expect(hook(shift({ status: "closed", difference: -10_000 }), { vatRateBps: DEFAULT_VAT_RATE_BPS })).toHaveLength(
      1,
    );
    expect(hook(shift({ status: "closed", difference: 0 }), { vatRateBps: DEFAULT_VAT_RATE_BPS })).toHaveLength(0);
  });

  it("won't close a shift twice", async () => {
    await expect(
      new CloseCashShift(repo(shift({ status: "closed" }))).execute("z1", { countedCash: 0 }, STAFF, NOW),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
