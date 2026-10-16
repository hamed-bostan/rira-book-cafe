import { describe, expect, it, vi } from "vitest";

import { cashCloseSchema } from "@/src/contracts/cash-schema";

import { ConflictError } from "../../../errors/ConflictError";
import { ValidationError } from "../../../errors/ValidationError";
import { CloseCashRegister, GetCashCloseStatus } from "../CashRegister";

import type { CashClose, CashDaySnapshot } from "../../../entities/CashClose";
import type { AuditHook } from "../../../repositories/AuditHook";
import type { CashCloseBuilder, ICashRegisterRepository } from "../../../repositories/ICashRegisterRepository";

const ACTOR = { id: "u1", name: "Sara" };
// 20:00 in Tehran on 16 Oct 2026.
const NOW = new Date("2026-10-16T16:30:00Z");

const SNAPSHOT: CashDaySnapshot = {
  day: "2026-10-16",
  openingFloat: 200_000,
  lines: [{ entryId: "e1", number: 1, description: "Order #9", source: "orderPayment", debit: 300_000, credit: 0 }],
};

/** A repository that runs the builder against `SNAPSHOT`, like the real one does inside its transaction. */
function repository(overrides: Partial<ICashRegisterRepository> = {}) {
  const close = vi.fn(async (_day: string, build: CashCloseBuilder, _audit?: AuditHook<CashClose>): Promise<CashClose> => {
    const built = build(SNAPSHOT);
    return { ...built.close, id: "c1", closedAt: NOW.toISOString(), entryId: built.entry ? "e9" : undefined };
  });
  return { close, lastClose: vi.fn(async () => null), cashActivityDays: vi.fn(async () => []), ...overrides } as unknown as ICashRegisterRepository & {
    close: typeof close;
  };
}

describe("CloseCashRegister", () => {
  it("closes against the books read in the closing transaction and audits the count", async () => {
    const repo = repository();
    const close = await new CloseCashRegister(repo).execute({ day: "2026-10-16", counted: 480_000, deposited: 0 }, ACTOR, NOW);
    expect(close).toMatchObject({ expected: 500_000, counted: 480_000, difference: -20_000, entryId: "e9" });
    const audit = repo.close.mock.calls[0][2];
    expect(audit?.(close)).toMatchObject({ action: "ledger.cashClosed", entityType: "ledger", actorName: "Sara" });
  });

  it("refuses a future day before touching the repository", async () => {
    const repo = repository();
    await expect(new CloseCashRegister(repo).execute({ day: "2026-10-17", counted: 1, deposited: 0 }, ACTOR, NOW)).rejects.toThrow(ValidationError);
    expect(repo.close).not.toHaveBeenCalled();
  });

  it("passes the expected-amount check through to the builder", async () => {
    await expect(new CloseCashRegister(repository()).execute({ day: "2026-10-16", counted: 1, deposited: 0, expectedSeen: 450_000 }, ACTOR, NOW)).rejects.toThrow(
      ConflictError,
    );
  });
});

describe("GetCashCloseStatus", () => {
  it("lists past active days since the last close", async () => {
    const last = { day: "2026-10-12" } as CashClose;
    const cashActivityDays = vi.fn(async () => ["2026-10-13", "2026-10-15", "2026-10-16"]);
    const status = await new GetCashCloseStatus(repository({ lastClose: vi.fn(async () => last), cashActivityDays })).execute(NOW);
    expect(cashActivityDays).toHaveBeenCalledWith("2026-10-13", "2026-10-16");
    expect(status).toEqual({ today: "2026-10-16", lastClosedDay: "2026-10-12", todayClosed: false, unclosedDays: ["2026-10-13", "2026-10-15"] });
  });

  it("looks back a bounded window when the till was never closed", async () => {
    const cashActivityDays = vi.fn(async () => []);
    await new GetCashCloseStatus(repository({ cashActivityDays })).execute(NOW);
    expect(cashActivityDays).toHaveBeenCalledWith("2026-08-17", "2026-10-16");
  });
});

describe("cashCloseSchema", () => {
  it("reads the form's strings; a blank deposit is zero and a zero count is allowed", () => {
    expect(cashCloseSchema.parse({ day: "2026-10-16", counted: "0", deposited: "", note: " " })).toEqual({
      day: "2026-10-16",
      counted: 0,
      deposited: 0,
      note: undefined,
    });
  });

  it("refuses a deposit larger than the count, and a missing count", () => {
    expect(cashCloseSchema.safeParse({ day: "2026-10-16", counted: "10", deposited: "11", note: "" }).success).toBe(false);
    expect(cashCloseSchema.safeParse({ day: "2026-10-16", counted: "", deposited: "", note: "" }).success).toBe(false);
  });
});
