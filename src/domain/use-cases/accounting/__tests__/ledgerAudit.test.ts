import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import {
  CreateLedgerAccount,
  PostManualEntry,
  ReverseJournalEntry,
  SetLedgerAccountActive,
  UpdateAccountingSettings,
} from "../LedgerCommands";

import type { Account, AccountingSettings, JournalEntry } from "../../../entities/Ledger";
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
    createdAt: "",
    ...overrides,
  };
}

const RENT: Account = { code: "6100", name: "Rent", nameFa: "اجاره", type: "expense", isSystem: false, isActive: true };

type Fake = {
  ledger: ILedgerRepository;
  post: ReturnType<typeof vi.fn<ILedgerRepository["post"]>>;
  reverse: ReturnType<typeof vi.fn<ILedgerRepository["reverse"]>>;
  createAccount: ReturnType<typeof vi.fn<ILedgerRepository["createAccount"]>>;
  setAccountActive: ReturnType<typeof vi.fn<ILedgerRepository["setAccountActive"]>>;
  updateSettings: ReturnType<typeof vi.fn<ILedgerRepository["updateSettings"]>>;
};

function ledgerWith(found: JournalEntry | null = entry(), settings: AccountingSettings = { vatRateBps: 1000 }): Fake {
  const post = vi.fn<ILedgerRepository["post"]>(async (input) => ({ ...input, id: "e9", number: 9, createdAt: "" }));
  const reverse = vi.fn<ILedgerRepository["reverse"]>(async () => entry({ id: "e2", number: 6, reversesId: "e1" }));
  const createAccount = vi.fn<ILedgerRepository["createAccount"]>(async (input) => ({ ...input, isSystem: false, isActive: true }));
  const setAccountActive = vi.fn<ILedgerRepository["setAccountActive"]>(async (code, active) => ({ ...RENT, code, isActive: active }));
  const updateSettings = vi.fn<ILedgerRepository["updateSettings"]>(async (next) => next);
  const ledger = {
    getEntry: vi.fn(async () => found),
    getSettings: vi.fn(async () => settings),
    post,
    reverse,
    createAccount,
    setAccountActive,
    updateSettings,
  } as unknown as ILedgerRepository;
  return { ledger, post, reverse, createAccount, setAccountActive, updateSettings };
}

describe("PostManualEntry", () => {
  it("posts a trimmed manual entry and audits its total", async () => {
    const { ledger, post } = ledgerWith();
    await new PostManualEntry(ledger).execute(
      {
        date: "2026-10-16",
        description: "  Owner's capital ",
        lines: [
          { accountCode: "1120", debit: 500, credit: 0, memo: "  " },
          { accountCode: "3100", debit: 0, credit: 500, memo: " opening " },
        ],
      },
      ACTOR,
      NOW,
    );
    const [sent, audit] = post.mock.calls[0];
    expect(sent).toMatchObject({ description: "Owner's capital", source: "manual", createdById: "owner" });
    expect(sent.lines.map((line) => line.memo)).toEqual([undefined, "opening"]);
    expect(audit?.(entry({ id: "e9", number: 9, lines: sent.lines }))).toEqual({
      actorId: "owner",
      actorName: "Rira",
      action: "ledger.entryPosted",
      entityType: "ledger",
      entityId: "e9",
      entityLabel: "JE-9",
      changes: [{ field: "amount", before: null, after: "500" }],
    });
  });
});

describe("ReverseJournalEntry", () => {
  it("reverses on the given date and audits which entry undid it", async () => {
    const { ledger, reverse } = ledgerWith(entry({ source: "gatewaySettlement" }));
    await new ReverseJournalEntry(ledger).execute("e1", "2026-10-16", "wrong amount", ACTOR, NOW);
    const [id, build, audit] = reverse.mock.calls[0];
    expect(id).toBe("e1");
    expect(build(entry())).toMatchObject({ date: "2026-10-16", description: "Reversal of JE-5: wrong amount", reversesId: "e1" });
    expect(audit?.(entry({ id: "e2", number: 6 }))).toMatchObject({
      action: "ledger.entryReversed",
      entityId: "e1",
      entityLabel: "JE-5",
      changes: [{ field: "reversedBy", before: null, after: "JE-6" }],
    });
  });

  it("is not found for an unknown entry, and refuses dating it in the future", async () => {
    await expect(new ReverseJournalEntry(ledgerWith(null).ledger).execute("e1", "2026-10-16", "x", ACTOR, NOW)).rejects.toThrow(NotFoundError);
    const { ledger, reverse } = ledgerWith();
    await expect(new ReverseJournalEntry(ledger).execute("e1", "2026-10-17", "x", ACTOR, NOW)).rejects.toMatchObject({ field: "date" });
    await expect(new ReverseJournalEntry(ledgerWith(entry({ source: "expense" })).ledger).execute("e1", "2026-10-16", "x", ACTOR, NOW)).rejects.toThrow(
      ConflictError,
    );
    expect(reverse).not.toHaveBeenCalled();
  });
});

describe("chart of accounts", () => {
  it("creates an account with trimmed names and audits it", async () => {
    const { ledger, createAccount } = ledgerWith();
    await new CreateLedgerAccount(ledger).execute({ code: "6100", name: " Rent ", nameFa: " اجاره ", type: "expense" }, ACTOR);
    const [sent, audit] = createAccount.mock.calls[0];
    expect(sent).toEqual({ code: "6100", name: "Rent", nameFa: "اجاره", type: "expense" });
    expect(audit?.(RENT)).toEqual({
      actorId: "owner",
      actorName: "Rira",
      action: "ledger.accountChanged",
      entityType: "ledger",
      entityId: "6100",
      entityLabel: "6100 Rent",
      changes: [{ field: "name", before: null, after: "Rent" }],
    });
  });

  it.each(["610", "61000", "61a0"])("refuses the code %s", async (code) => {
    const { ledger, createAccount } = ledgerWith();
    await expect(new CreateLedgerAccount(ledger).execute({ code, name: "x", nameFa: "x", type: "expense" }, ACTOR)).rejects.toMatchObject({
      field: "code",
    });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("audits switching an account off as a flip of isActive", async () => {
    const { ledger, setAccountActive } = ledgerWith();
    await new SetLedgerAccountActive(ledger).execute("6100", false, ACTOR);
    const [code, active, audit] = setAccountActive.mock.calls[0];
    expect([code, active]).toEqual(["6100", false]);
    expect(audit?.({ ...RENT, isActive: false })?.changes).toEqual([{ field: "isActive", before: "true", after: "false" }]);
  });
});

describe("UpdateAccountingSettings", () => {
  it("audits the settings that moved", async () => {
    const { ledger, updateSettings } = ledgerWith(entry(), { vatRateBps: 1000 });
    await new UpdateAccountingSettings(ledger).execute({ vatRateBps: 900, booksClosedThrough: "2026-09-30" }, ACTOR, NOW);
    const [sent, audit] = updateSettings.mock.calls[0];
    expect(audit?.(sent)).toEqual({
      actorId: "owner",
      actorName: "Rira",
      action: "ledger.settingsChanged",
      entityType: "ledger",
      entityId: "settings",
      entityLabel: "Accounting settings",
      changes: [
        { field: "vatRateBps", before: "1000", after: "900" },
        { field: "booksClosedThrough", before: null, after: "2026-09-30" },
      ],
    });
  });

  it("records nothing when nothing changed", async () => {
    const { ledger, updateSettings } = ledgerWith(entry(), { vatRateBps: 1000 });
    await new UpdateAccountingSettings(ledger).execute({ vatRateBps: 1000 }, ACTOR, NOW);
    const [sent, audit] = updateSettings.mock.calls[0];
    expect(audit?.(sent)).toBeNull();
  });

  it.each([-1, 5001, 9.5])("refuses a VAT rate of %s bps", async (vatRateBps) => {
    const { ledger, updateSettings } = ledgerWith();
    await expect(new UpdateAccountingSettings(ledger).execute({ vatRateBps }, ACTOR, NOW)).rejects.toThrow(ValidationError);
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
