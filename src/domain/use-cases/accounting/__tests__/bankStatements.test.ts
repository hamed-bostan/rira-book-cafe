import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import {
  AddStatementLines,
  AutoMatchBankLines,
  CreateBankStatement,
  GetBankReconciliation,
  ListBankStatements,
  MatchBankLines,
  ReconcileBankStatement,
  RecordStatementLine,
  RemoveStatementLine,
  UnmatchBankLines,
} from "../BankReconciliation";

import type { BankStatement, BookFigures, LedgerCandidate } from "../../../entities/BankReconciliation";
import type { IBankReconciliationRepository, StatementChange } from "../../../repositories/IBankReconciliationRepository";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";

const ACTOR = { id: "owner", name: "Rira" };
const NOW = new Date("2026-10-16T08:00:00Z");

function statement(overrides: Partial<BankStatement> = {}): BankStatement {
  return {
    id: "s1",
    accountCode: "1120",
    fromDay: "2026-09-23",
    toDay: "2026-10-15",
    openingBalance: 1_000_000,
    closingBalance: 1_500_000,
    status: "open",
    createdByName: "Rira",
    createdAt: "",
    lines: [{ id: "in", date: "2026-10-01", description: "Card sales", amount: 500_000 }],
    ...overrides,
  };
}

const CANDIDATE: LedgerCandidate = {
  lineId: "jl1",
  entryId: "e1",
  entryNumber: 3,
  date: "2026-10-01",
  description: "Order payments",
  source: "orderPayment",
  amount: 500_000,
};

const BOOK: BookFigures = { bookBalance: 1_500_000, outstanding: 0, outstandingCount: 0, clearedAfter: 0 };

type Fake = {
  bank: IBankReconciliationRepository;
  createStatement: ReturnType<typeof vi.fn<IBankReconciliationRepository["createStatement"]>>;
  addLines: ReturnType<typeof vi.fn<IBankReconciliationRepository["addLines"]>>;
  removeLine: ReturnType<typeof vi.fn<IBankReconciliationRepository["removeLine"]>>;
  match: ReturnType<typeof vi.fn<IBankReconciliationRepository["match"]>>;
  unmatch: ReturnType<typeof vi.fn<IBankReconciliationRepository["unmatch"]>>;
  reconcile: ReturnType<typeof vi.fn<IBankReconciliationRepository["reconcile"]>>;
};

function bankWith(current: BankStatement | null, candidates: LedgerCandidate[] = [CANDIDATE]): Fake {
  const createStatement = vi.fn<IBankReconciliationRepository["createStatement"]>(async (input) => statement({ ...input, lines: [] }));
  const addLines = vi.fn<IBankReconciliationRepository["addLines"]>(async () => statement());
  const removeLine = vi.fn<IBankReconciliationRepository["removeLine"]>(async () => statement());
  const match = vi.fn<IBankReconciliationRepository["match"]>(async (_id, groups) => groups.length);
  const unmatch = vi.fn<IBankReconciliationRepository["unmatch"]>(async () => {});
  const reconcile = vi.fn<IBankReconciliationRepository["reconcile"]>(async () => statement({ status: "reconciled" }));
  const bank = {
    listStatements: vi.fn(async () => []),
    getStatement: vi.fn(async () => current),
    candidates: vi.fn(async () => candidates),
    bookFigures: vi.fn(async () => BOOK),
    createStatement,
    addLines,
    removeLine,
    match,
    unmatch,
    reconcile,
  } as unknown as IBankReconciliationRepository;
  return { bank, createStatement, addLines, removeLine, match, unmatch, reconcile };
}

const CHANGE: StatementChange = { statement: statement(), count: 2 };

describe("reading statements", () => {
  it("lists statements", async () => {
    const { bank } = bankWith(null);
    expect(await new ListBankStatements(bank).execute()).toEqual([]);
  });

  it("is null for a statement that doesn't exist", async () => {
    expect(await new GetBankReconciliation(bankWith(null).bank).execute("s1")).toBeNull();
  });

  it("offers suggestions only while the statement is open", async () => {
    const open = await new GetBankReconciliation(bankWith(statement()).bank).execute("s1");
    expect(open?.suggestions).toEqual([{ statementLineId: "in", ledgerLineId: "jl1" }]);
    expect(open?.candidates).toEqual([CANDIDATE]);
    expect(open?.summary.canReconcile).toBe(false);

    const closed = await new GetBankReconciliation(bankWith(statement({ status: "reconciled" })).bank).execute("s1");
    expect(closed?.suggestions).toEqual([]);
  });
});

describe("CreateBankStatement", () => {
  it("records the statement under the actor and audits its closing balance", async () => {
    const { bank, createStatement } = bankWith(null);
    const input = { fromDay: "2026-09-23", toDay: "2026-10-15", openingBalance: 1_000_000, closingBalance: 1_500_000, lines: [] };
    await new CreateBankStatement(bank).execute(input, ACTOR, NOW);
    const [sent, audit] = createStatement.mock.calls[0];
    expect(sent).toEqual({ ...input, createdById: "owner", createdByName: "Rira" });
    expect(audit?.(statement())).toEqual({
      actorId: "owner",
      actorName: "Rira",
      action: "ledger.bankStatementChanged",
      entityType: "ledger",
      entityId: "s1",
      entityLabel: "Bank statement 2026-09-23 – 2026-10-15",
      changes: [{ field: "closingBalance", before: null, after: "1500000" }],
    });
  });

  it("refuses a period that ends before it starts, and a zero line", async () => {
    const { bank, createStatement } = bankWith(null);
    const base = { openingBalance: 0, closingBalance: 0, lines: [] };
    await expect(new CreateBankStatement(bank).execute({ ...base, fromDay: "2026-10-10", toDay: "2026-10-01" }, ACTOR, NOW)).rejects.toThrow(
      "periodEndsBeforeStart",
    );
    await expect(
      new CreateBankStatement(bank).execute(
        { ...base, fromDay: "2026-10-01", toDay: "2026-10-10", lines: [{ date: "2026-10-05", description: "x", amount: 0 }] },
        ACTOR,
        NOW,
      ),
    ).rejects.toThrow("amountInvalid");
    expect(createStatement).not.toHaveBeenCalled();
  });
});

describe("statement lines and matches", () => {
  it("adds lines inside the period, audited by how many", async () => {
    const { bank, addLines } = bankWith(statement());
    const lines = [{ date: "2026-10-02", description: "Interest", amount: 1_000 }];
    await new AddStatementLines(bank).execute("s1", lines, ACTOR);
    const [id, sent, audit] = addLines.mock.calls[0];
    expect([id, sent]).toEqual(["s1", lines]);
    expect(audit?.(CHANGE)).toMatchObject({ action: "ledger.bankStatementChanged", changes: [{ field: "linesAdded", before: null, after: "2" }] });
  });

  it("refuses adding lines outside the period or to a missing statement", async () => {
    const { bank, addLines } = bankWith(statement());
    await expect(new AddStatementLines(bank).execute("s1", [{ date: "2026-11-01", description: "x", amount: 5 }], ACTOR)).rejects.toThrow(
      "lineOutsidePeriod",
    );
    await expect(new AddStatementLines(bankWith(null).bank).execute("s1", [], ACTOR)).rejects.toThrow(NotFoundError);
    expect(addLines).not.toHaveBeenCalled();
  });

  it("removes, matches and unmatches with an audit entry naming the change", async () => {
    const { bank, removeLine, match, unmatch } = bankWith(statement());
    await new RemoveStatementLine(bank).execute("s1", "in", ACTOR);
    expect(removeLine.mock.calls[0][2]?.(CHANGE)?.changes[0].field).toBe("linesRemoved");

    const group = { statementLineIds: ["in"], ledgerLineIds: ["jl1"] };
    expect(await new MatchBankLines(bank).execute("s1", group, ACTOR)).toBe(1);
    expect(match.mock.calls[0].slice(0, 3)).toEqual(["s1", [group], ACTOR]);
    expect(match.mock.calls[0][3]?.(CHANGE)).toMatchObject({ action: "ledger.bankMatched", changes: [{ field: "matched" }] });

    await new UnmatchBankLines(bank).execute("s1", "m1", ACTOR);
    expect(unmatch.mock.calls[0][2]?.(CHANGE)).toMatchObject({ action: "ledger.bankUnmatched", changes: [{ field: "unmatched" }] });
  });
});

describe("AutoMatchBankLines", () => {
  it("does nothing when there's no safe pair", async () => {
    const { bank, match } = bankWith(statement(), []);
    expect(await new AutoMatchBankLines(bank).execute("s1", ACTOR)).toBe(0);
    expect(match).not.toHaveBeenCalled();
  });

  it("refuses a reconciled statement and a missing one", async () => {
    await expect(new AutoMatchBankLines(bankWith(statement({ status: "reconciled" })).bank).execute("s1", ACTOR)).rejects.toMatchObject({
      code: "STATEMENT_RECONCILED",
    });
    await expect(new AutoMatchBankLines(bankWith(null).bank).execute("s1", ACTOR)).rejects.toThrow(NotFoundError);
  });
});

describe("RecordStatementLine", () => {
  const ledger = { movements: vi.fn(async () => []) } as unknown as ILedgerRepository;

  it("refuses an unknown line and a fee on anything but a payout", async () => {
    const { bank } = bankWith(statement());
    await expect(new RecordStatementLine(bank, ledger).execute("s1", "nope", { kind: "interest", fee: 0 }, ACTOR)).rejects.toThrow(NotFoundError);
    await expect(new RecordStatementLine(bank, ledger).execute("s1", "in", { kind: "interest", fee: 10 }, ACTOR)).rejects.toThrow(ValidationError);
    await expect(new RecordStatementLine(bank, ledger).execute("s1", "in", { kind: "gatewayPayout", fee: -1 }, ACTOR)).rejects.toThrow(
      "amountInvalid",
    );
  });

  it("refuses a payout when the gateway holds nothing", async () => {
    const { bank } = bankWith(statement());
    await expect(new RecordStatementLine(bank, ledger).execute("s1", "in", { kind: "gatewayPayout", fee: 0 }, ACTOR)).rejects.toThrow(
      "exceedsGatewayBalance",
    );
  });
});

describe("ReconcileBankStatement", () => {
  it("refuses a statement that's already reconciled", async () => {
    const { bank, reconcile } = bankWith(statement());
    await new ReconcileBankStatement(bank).execute("s1", ACTOR);
    const check = reconcile.mock.calls[0][2];
    expect(() => check(statement({ status: "reconciled" }), BOOK)).toThrow("already reconciled");
    expect(reconcile.mock.calls[0][3]?.(statement({ status: "reconciled" }))).toMatchObject({
      action: "ledger.bankReconciled",
      changes: [{ field: "status", before: "open", after: "reconciled" }],
    });
  });
});
