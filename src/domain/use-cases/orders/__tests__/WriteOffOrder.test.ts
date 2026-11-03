import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { WriteOffOrder } from "../WriteOffOrder";

import type { JournalEntry } from "../../../entities/Ledger";
import type { Order } from "../../../entities/Order";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";
import type { IOrderRepository } from "../../../repositories/IOrderRepository";

const OWNER = { id: "owner", name: "Rira" };
/** 13:30 in Tehran on 2026-10-20. */
const NOW = new Date("2026-10-20T10:00:00Z");
const SETTINGS = { vatRateBps: 1000 };

const ORDER = {
  id: "o1",
  orderNumber: 42,
  status: "completed",
  paymentStatus: "unpaid",
  total: 300_000,
  refundedTotal: 0,
  items: [],
} as unknown as Order;

const SALE = {
  id: "je-sale",
  source: "orderSale",
  lines: [
    { accountCode: "1150", debit: 300_000, credit: 0 },
    { accountCode: "4100", debit: 0, credit: 90_909 },
    { accountCode: "4300", debit: 0, credit: 200_000 },
    { accountCode: "2200", debit: 0, credit: 9_091 },
  ],
} as JournalEntry;
const COST = { id: "je-cost", source: "orderCost", lines: [] } as unknown as JournalEntry;

const ledgerWith = (entries: JournalEntry[]): Pick<ILedgerRepository, "entriesFor"> => ({
  entriesFor: vi.fn(async () => entries),
});

function repoWith(order: Order | null) {
  const writeOff = vi.fn<IOrderRepository["writeOff"]>(async () => ({ ...ORDER, status: "cancelled" }));
  return { repo: { getById: vi.fn(async () => order), writeOff } as unknown as IOrderRepository, writeOff };
}

describe("WriteOffOrder", () => {
  it("cancels the order, logs who did it and why, and takes the sale back off the books", async () => {
    const { repo, writeOff } = repoWith(ORDER);
    await new WriteOffOrder(repo, ledgerWith([SALE, COST])).execute("o1", { reason: " Walked out " }, OWNER, NOW);

    const [id, actor, audit, ledger] = writeOff.mock.calls[0];
    expect([id, actor]).toEqual(["o1", OWNER]);
    const cancelled = { ...ORDER, status: "cancelled" } as Order;
    expect(audit?.(cancelled)).toMatchObject({
      action: "order.writtenOff",
      entityType: "order",
      entityId: "o1",
      entityLabel: "#42",
      changes: [
        { field: "status", before: "completed", after: "cancelled" },
        { field: "reason", before: null, after: "Walked out" },
      ],
    });
    const entries = ledger?.(cancelled, SETTINGS) ?? [];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      source: "orderWriteOff",
      date: "2026-10-20",
      description: "Order #42 — written off: Walked out",
    });
    expect(entries[0].lines).toContainEqual({ accountCode: "1150", debit: 0, credit: 300_000 });
  });

  it("books nothing for an order whose sale never reached the books", async () => {
    const { repo, writeOff } = repoWith(ORDER);
    await new WriteOffOrder(repo, ledgerWith([])).execute("o1", {}, OWNER, NOW);

    const ledger = writeOff.mock.calls[0][3];
    expect(ledger?.({ ...ORDER, status: "cancelled" }, SETTINGS)).toEqual([]);
    expect(writeOff.mock.calls[0][2]?.(ORDER)?.changes).toHaveLength(1);
  });

  it("refuses an order that isn't served, or that someone paid", async () => {
    for (const order of [
      { ...ORDER, status: "preparing" },
      { ...ORDER, paymentStatus: "paid" },
      { ...ORDER, status: "cancelled" },
    ] as Order[]) {
      const { repo, writeOff } = repoWith(order);
      await expect(new WriteOffOrder(repo, ledgerWith([SALE])).execute("o1", {}, OWNER, NOW)).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(writeOff).not.toHaveBeenCalled();
    }
  });

  it("refuses a missing order and an overlong reason", async () => {
    await expect(
      new WriteOffOrder(repoWith(null).repo, ledgerWith([])).execute("nope", {}, OWNER, NOW),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      new WriteOffOrder(repoWith(ORDER).repo, ledgerWith([SALE])).execute("o1", { reason: "x".repeat(201) }, OWNER),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
