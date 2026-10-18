import { describe, expect, it, vi } from "vitest";

import { gatewaySettlementSchema } from "@/src/contracts/payment-schema";

import { assertBalanced, type JournalEntry, type NewJournalEntry } from "../../../entities/Ledger";
import { gatewaySettlementEntry } from "../../../entities/Postings";
import { ConflictError } from "../../../errors/ConflictError";
import { ValidationError } from "../../../errors/ValidationError";
import { RecordGatewaySettlement, ReverseJournalEntry } from "../LedgerCommands";

import type { AccountMovement } from "../../../entities/AccountingReports";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";

const ACTOR = { id: "owner", name: "Rira" };
const NOW = new Date("2026-10-16T08:00:00Z");

/** A ledger whose gateway clearing account (1130) holds `held` Toman. */
function ledgerHolding(held: number) {
  const movements: AccountMovement[] = [{ accountCode: "1130", debit: held + 50_000, credit: 50_000 }];
  const post = vi.fn(async (entry: NewJournalEntry): Promise<JournalEntry> => ({
    ...entry,
    id: "e9",
    number: 9,
    createdAt: NOW.toISOString(),
  }));
  const ledger = { movements: vi.fn(async () => movements), post } as unknown as ILedgerRepository;
  return { ledger, post };
}

describe("gateway payout posting", () => {
  it("debits the bank and the fee, credits gateway clearing, and balances", () => {
    const entry = gatewaySettlementEntry(
      { date: "2026-10-15", deposited: 990_000, fee: 10_000, reference: "ST-77" },
      ACTOR,
    );
    expect(entry.source).toBe("gatewaySettlement");
    expect(entry.lines).toEqual([
      { accountCode: "1120", debit: 990_000, credit: 0, memo: "ST-77" },
      { accountCode: "6700", debit: 10_000, credit: 0 },
      { accountCode: "1130", debit: 0, credit: 1_000_000 },
    ]);
    expect(() => assertBalanced(entry)).not.toThrow();
  });

  it("drops the fee line when there was no fee", () => {
    const entry = assertBalanced(gatewaySettlementEntry({ date: "2026-10-15", deposited: 500_000, fee: 0 }, ACTOR));
    expect(entry.lines.map((line) => line.accountCode)).toEqual(["1120", "1130"]);
  });
});

describe("RecordGatewaySettlement", () => {
  it("posts the payout when the gateway holds enough", async () => {
    const { ledger, post } = ledgerHolding(1_000_000);
    await new RecordGatewaySettlement(ledger).execute(
      { date: "2026-10-15", deposited: 990_000, fee: 10_000 },
      ACTOR,
      NOW,
    );
    expect(ledger.movements).toHaveBeenCalledWith(undefined, "2026-10-15");
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ source: "gatewaySettlement" }), expect.any(Function));
  });

  it("refuses to clear more than the gateway holds on that date", async () => {
    const { ledger, post } = ledgerHolding(1_000_000);
    await expect(
      new RecordGatewaySettlement(ledger).execute({ date: "2026-10-15", deposited: 1_000_000, fee: 1 }, ACTOR, NOW),
    ).rejects.toMatchObject({ field: "deposited", message: "exceedsGatewayBalance" });
    expect(post).not.toHaveBeenCalled();
  });

  it("refuses a future payout", async () => {
    const { ledger, post } = ledgerHolding(1_000_000);
    await expect(
      new RecordGatewaySettlement(ledger).execute({ date: "2026-10-17", deposited: 1, fee: 0 }, ACTOR, NOW),
    ).rejects.toThrow(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it("can be reversed from the journal, unlike order postings", async () => {
    const payout = {
      ...gatewaySettlementEntry({ date: "2026-10-15", deposited: 1, fee: 0 }, ACTOR),
      id: "e9",
      number: 9,
      createdAt: NOW.toISOString(),
    };
    const reverse = vi.fn(async () => payout);
    const ledger = { getEntry: vi.fn(async () => payout), reverse } as unknown as ILedgerRepository;
    await new ReverseJournalEntry(ledger).execute("e9", "2026-10-16", "wrong amount", ACTOR, NOW);
    expect(reverse).toHaveBeenCalled();

    const sale = { ...payout, source: "orderPayment" as const };
    const saleLedger = { getEntry: vi.fn(async () => sale), reverse } as unknown as ILedgerRepository;
    await expect(new ReverseJournalEntry(saleLedger).execute("e9", "2026-10-16", "x", ACTOR, NOW)).rejects.toThrow(
      ConflictError,
    );
  });
});

describe("gatewaySettlementSchema", () => {
  it("reads the form's strings as whole Toman, a blank fee as zero", () => {
    expect(gatewaySettlementSchema.parse({ date: "2026-10-15", deposited: "990000", fee: "", reference: " " })).toEqual(
      {
        date: "2026-10-15",
        deposited: 990_000,
        fee: 0,
        reference: undefined,
      },
    );
  });

  it("requires a deposit", () => {
    expect(
      gatewaySettlementSchema.safeParse({ date: "2026-10-15", deposited: "", fee: "10", reference: "" }).success,
    ).toBe(false);
  });
});
