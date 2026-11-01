import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { RecordIncome, VoidIncome, type RecordIncomeInput } from "../IncomeCommands";

import type { Income } from "../../../entities/Income";
import type { Account, JournalEntry } from "../../../entities/Ledger";
import type { IIncomeRepository } from "../../../repositories/IIncomeRepository";

const ACTOR = { id: "owner", name: "Rira" };
/** 13:30 in Tehran on 2026-10-20. */
const NOW = new Date("2026-10-20T10:00:00Z");

const REVENUE: Account = {
  code: "4900",
  name: "Other income",
  nameFa: "",
  type: "revenue",
  isSystem: true,
  isActive: true,
};

const INPUT: RecordIncomeInput = {
  date: "2026-10-20",
  accountCode: "4900",
  description: " Room hire ",
  amount: 1_100_000,
  vatAmount: 100_000,
  method: "transfer",
  payerName: " Book club ",
};

function income(overrides: Partial<Income> = {}): Income {
  return {
    id: "n1",
    number: 3,
    date: "2026-10-20",
    accountCode: "4900",
    description: "Room hire",
    amount: 1_100_000,
    vatAmount: 100_000,
    method: "transfer",
    status: "received",
    createdById: ACTOR.id,
    createdByName: ACTOR.name,
    createdAt: "",
    ...overrides,
  };
}

function repoWith(current: Income | null) {
  const create = vi.fn<IIncomeRepository["create"]>(async (input) => income(input));
  const voidIncome = vi.fn<IIncomeRepository["void"]>(async () => income({ status: "void" }));
  const repo = { create, void: voidIncome, getIncome: vi.fn(async () => current) } as unknown as IIncomeRepository;
  return { repo, create, voidIncome };
}

const ledger = (account: Account | null = REVENUE) => ({ getAccount: vi.fn(async () => account) });

describe("RecordIncome", () => {
  it("records it, trimmed, and books it into the method's account", async () => {
    const { repo, create } = repoWith(null);
    const saved = await new RecordIncome(repo, ledger()).execute(INPUT, ACTOR, NOW);

    expect(create.mock.calls[0][0]).toMatchObject({ description: "Room hire", payerName: "Book club" });
    const [hook, audit] = [create.mock.calls[0][1], create.mock.calls[0][2]];
    expect(hook(saved, { vatRateBps: 1000 })[0]).toMatchObject({ source: "income", uniqueKey: "income:n1" });
    expect(audit?.(saved)).toMatchObject({ action: "income.recorded", entityType: "income" });
  });

  it("refuses a future date, a VAT of the whole total, and a blank description", async () => {
    const useCase = new RecordIncome(repoWith(null).repo, ledger());

    await expect(useCase.execute({ ...INPUT, date: "2026-10-21" }, ACTOR, NOW)).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ ...INPUT, vatAmount: 1_100_000 }, ACTOR, NOW)).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ ...INPUT, description: " " }, ACTOR, NOW)).rejects.toThrow(ValidationError);
  });

  it("only books to an active revenue account", async () => {
    const { repo } = repoWith(null);
    const expenseAccount: Account = { ...REVENUE, code: "6100", type: "expense" };

    await expect(new RecordIncome(repo, ledger(expenseAccount)).execute(INPUT, ACTOR, NOW)).rejects.toThrow(
      ValidationError,
    );
    await expect(
      new RecordIncome(repo, ledger({ ...REVENUE, isActive: false })).execute(INPUT, ACTOR, NOW),
    ).rejects.toThrow(ValidationError);
  });

  it("needs both halves of what it was paid for", async () => {
    await expect(
      new RecordIncome(repoWith(null).repo, ledger()).execute({ ...INPUT, sourceType: "suiteBooking" }, ACTOR, NOW),
    ).rejects.toThrow(ValidationError);
  });
});

describe("VoidIncome", () => {
  it("reverses its entry today, with the reason", async () => {
    const { repo, voidIncome } = repoWith(income());
    await new VoidIncome(repo).execute("n1", "Handed back", ACTOR, NOW);

    const reversal = voidIncome.mock.calls[0][1]({
      id: "je1",
      number: 9,
      date: "2026-10-01",
      description: "x",
      source: "income",
      lines: [
        { accountCode: "1120", debit: 1_100_000, credit: 0 },
        { accountCode: "4900", debit: 0, credit: 1_100_000 },
      ],
      createdById: ACTOR.id,
      createdByName: ACTOR.name,
      createdAt: "",
    } satisfies JournalEntry);
    expect(reversal).toMatchObject({ date: "2026-10-20", description: "Reversal of JE-9: Handed back" });
  });

  it("refuses an unknown entry, or one already void", async () => {
    await expect(new VoidIncome(repoWith(null).repo).execute("n1", "", ACTOR, NOW)).rejects.toThrow(NotFoundError);
    await expect(
      new VoidIncome(repoWith(income({ status: "void" })).repo).execute("n1", "", ACTOR, NOW),
    ).rejects.toThrow(ConflictError);
  });
});
