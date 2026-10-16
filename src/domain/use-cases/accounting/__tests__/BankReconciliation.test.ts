import { describe, expect, it, vi } from "vitest";

import { bankStatementSchema } from "@/src/contracts/bank-schema";

import { ConflictError } from "../../../errors/ConflictError";
import { ValidationError } from "../../../errors/ValidationError";
import { AutoMatchBankLines, CreateBankStatement, ReconcileBankStatement, RecordStatementLine } from "../BankReconciliation";

import type { AccountMovement } from "../../../entities/AccountingReports";
import type { BankStatement, BookFigures, LedgerCandidate } from "../../../entities/BankReconciliation";
import type { JournalEntry, NewJournalEntry } from "../../../entities/Ledger";
import type { IBankReconciliationRepository } from "../../../repositories/IBankReconciliationRepository";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";

const ACTOR = { id: "owner", name: "Rira" };
const NOW = new Date("2026-10-16T08:00:00Z");

const STATEMENT: BankStatement = {
  id: "s1",
  accountCode: "1120",
  fromDay: "2026-09-23",
  toDay: "2026-10-15",
  openingBalance: 1_000_000,
  closingBalance: 1_978_000,
  status: "open",
  createdByName: "Rira",
  createdAt: NOW.toISOString(),
  lines: [
    { id: "fee", date: "2026-10-01", description: "SMS fee", amount: -12_000 },
    { id: "payout", date: "2026-10-05", description: "Zarinpal", reference: "ST-1", amount: 990_000 },
  ],
};

function bankRepository(overrides: Partial<IBankReconciliationRepository> = {}) {
  const postAndMatch = vi.fn(async (_s: string, lineId: string, build: (line: BankStatement["lines"][number]) => NewJournalEntry): Promise<JournalEntry> => {
    const entry = build(STATEMENT.lines.find((line) => line.id === lineId)!);
    return { ...entry, id: "e1", number: 41, createdAt: NOW.toISOString() };
  });
  return {
    getStatement: vi.fn(async () => STATEMENT),
    postAndMatch,
    ...overrides,
  } as unknown as IBankReconciliationRepository & { postAndMatch: typeof postAndMatch };
}

const ledgerHolding = (held: number) =>
  ({ movements: vi.fn(async (): Promise<AccountMovement[]> => [{ accountCode: "1130", debit: held, credit: 0 }]) }) as unknown as ILedgerRepository;

describe("RecordStatementLine", () => {
  it("books a fee from a money-out line", async () => {
    const bank = bankRepository();
    const entry = await new RecordStatementLine(bank, ledgerHolding(0)).execute("s1", "fee", { kind: "fee", fee: 0 }, ACTOR);
    expect(entry.source).toBe("bankFee");
    expect(entry.lines).toContainEqual({ accountCode: "1120", debit: 0, credit: 12_000, memo: undefined });
  });

  it("books a gateway payout with its fee against gateway clearing", async () => {
    const bank = bankRepository();
    const entry = await new RecordStatementLine(bank, ledgerHolding(1_000_000)).execute("s1", "payout", { kind: "gatewayPayout", fee: 10_000 }, ACTOR);
    expect(entry.lines).toEqual([
      { accountCode: "1120", debit: 990_000, credit: 0, memo: "ST-1" },
      { accountCode: "6700", debit: 10_000, credit: 0 },
      { accountCode: "1130", debit: 0, credit: 1_000_000 },
    ]);
  });

  it("refuses a payout above what the gateway holds, and a posting against the line's direction", async () => {
    await expect(new RecordStatementLine(bankRepository(), ledgerHolding(500_000)).execute("s1", "payout", { kind: "gatewayPayout", fee: 0 }, ACTOR)).rejects.toMatchObject({
      field: "fee",
      message: "exceedsGatewayBalance",
    });
    await expect(new RecordStatementLine(bankRepository(), ledgerHolding(0)).execute("s1", "fee", { kind: "interest", fee: 0 }, ACTOR)).rejects.toThrow(ValidationError);
    await expect(new RecordStatementLine(bankRepository(), ledgerHolding(0)).execute("s1", "payout", { kind: "interest", fee: 5 }, ACTOR)).rejects.toThrow(ValidationError);
  });
});

describe("AutoMatchBankLines", () => {
  it("matches only the safe one-to-one pairs, in one call", async () => {
    const candidates: LedgerCandidate[] = [
      { lineId: "l1", entryId: "e1", entryNumber: 1, date: "2026-10-05", description: "payout", source: "gatewaySettlement", amount: 990_000 },
    ];
    const match = vi.fn(async () => 1);
    const bank = bankRepository({ candidates: vi.fn(async () => candidates), match });
    expect(await new AutoMatchBankLines(bank).execute("s1", ACTOR)).toBe(1);
    expect(match).toHaveBeenCalledWith("s1", [{ statementLineIds: ["payout"], ledgerLineIds: ["l1"] }], ACTOR, expect.any(Function));
  });
});

describe("ReconcileBankStatement", () => {
  const matched: BankStatement = { ...STATEMENT, lines: STATEMENT.lines.map((line) => ({ ...line, matchId: "m" })) };

  function reconcileWith(book: BookFigures, statement: BankStatement = matched) {
    const reconcile = vi.fn(async (_id: string, _actor: unknown, check: (s: BankStatement, b: BookFigures) => void) => {
      check(statement, book);
      return { ...statement, status: "reconciled" as const };
    });
    return { bank: bankRepository({ reconcile }), reconcile };
  }

  it("signs off when the adjusted book balance equals the closing balance", async () => {
    const { bank } = reconcileWith({ bookBalance: 1_978_000, outstanding: 0, outstandingCount: 0, clearedAfter: 0 });
    await expect(new ReconcileBankStatement(bank).execute("s1", ACTOR)).resolves.toMatchObject({ status: "reconciled" });
  });

  it("refuses with a difference or an unmatched line", async () => {
    const off = reconcileWith({ bookBalance: 1_977_000, outstanding: 0, outstandingCount: 0, clearedAfter: 0 });
    await expect(new ReconcileBankStatement(off.bank).execute("s1", ACTOR)).rejects.toThrow(ConflictError);
    const unmatched = reconcileWith({ bookBalance: 1_978_000, outstanding: 0, outstandingCount: 0, clearedAfter: 0 }, STATEMENT);
    await expect(new ReconcileBankStatement(unmatched.bank).execute("s1", ACTOR)).rejects.toMatchObject({ code: "NOT_RECONCILED" });
  });
});

describe("CreateBankStatement", () => {
  it("refuses lines outside the period and a future period", async () => {
    const createStatement = vi.fn();
    const bank = bankRepository({ createStatement });
    const input = { fromDay: "2026-09-23", toDay: "2026-10-15", openingBalance: 0, closingBalance: 5, lines: [{ date: "2026-10-20", description: "x", amount: 5 }] };
    await expect(new CreateBankStatement(bank).execute(input, ACTOR, NOW)).rejects.toMatchObject({ field: "lines", message: "lineOutsidePeriod" });
    await expect(new CreateBankStatement(bank).execute({ ...input, toDay: "2026-10-20" }, ACTOR, NOW)).rejects.toThrow(ValidationError);
    expect(createStatement).not.toHaveBeenCalled();
  });
});

describe("bankStatementSchema", () => {
  it("reads signed balances and lines", () => {
    const parsed = bankStatementSchema.parse({
      fromDay: "2026-09-23",
      toDay: "2026-10-22",
      openingBalance: "-5000",
      closingBalance: "0",
      lines: [{ date: "2026-10-01", description: " Deposit ", reference: "", amount: "5000" }],
    });
    expect(parsed).toMatchObject({ openingBalance: -5_000, closingBalance: 0, lines: [{ description: "Deposit", reference: undefined, amount: 5_000 }] });
  });

  it("refuses a zero line, a line outside the period and a backwards period", () => {
    const base = { fromDay: "2026-09-23", toDay: "2026-10-22", openingBalance: "0", closingBalance: "0" };
    expect(bankStatementSchema.safeParse({ ...base, lines: [{ date: "2026-10-01", description: "x", reference: "", amount: "0" }] }).success).toBe(false);
    expect(bankStatementSchema.safeParse({ ...base, lines: [{ date: "2026-11-01", description: "x", reference: "", amount: "1" }] }).success).toBe(false);
    expect(bankStatementSchema.safeParse({ ...base, toDay: "2026-09-01", lines: [] }).success).toBe(false);
  });
});
