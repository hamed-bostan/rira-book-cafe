import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { refundPostings } from "../orderLedger";
import { RefundOrder } from "../RefundOrder";
import { SetOrderPayment } from "../SetOrderPayment";

import type { JournalEntry } from "../../../entities/Ledger";
import type { Order } from "../../../entities/Order";
import type { OrderRefund } from "../../../entities/OrderRefund";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";
import type { IOrderRepository } from "../../../repositories/IOrderRepository";

const STAFF = { id: "owner", name: "Rira" };
/** 13:30 in Tehran on 2026-10-20. */
const NOW = new Date("2026-10-20T10:00:00Z");

const ORDER = {
  id: "o1",
  orderNumber: 42,
  status: "completed",
  paymentStatus: "paid",
  paymentMethod: "card",
  total: 300_000,
  refundedTotal: 0,
  items: [
    { id: "i1", kind: "drink", name: "Latte", unitPrice: 100_000, quantity: 1 },
    { id: "i2", kind: "book", name: "Novel", unitPrice: 200_000, quantity: 1, taxExempt: true, unitCost: 120_000 },
  ],
} as Order;

const SALE = {
  source: "orderSale",
  lines: [
    { accountCode: "1150", debit: 300_000, credit: 0 },
    { accountCode: "4100", debit: 0, credit: 90_909 },
    { accountCode: "4300", debit: 0, credit: 200_000 },
    { accountCode: "2200", debit: 0, credit: 9_091 },
  ],
} as JournalEntry;

const ledgerWith = (entries: JournalEntry[]): Pick<ILedgerRepository, "entriesFor"> => ({
  entriesFor: vi.fn(async () => entries),
});

function repoWith(order: Order | null) {
  const refund = vi.fn<IOrderRepository["refund"]>(async (input) => ({
    refund: { ...input, id: "r1", number: 1, createdAt: "" } satisfies OrderRefund,
    order: { ...ORDER, refundedTotal: input.amount },
    restockedValue: 0,
  }));
  return {
    repo: { getById: vi.fn(async () => order), refund } as unknown as IOrderRepository,
    refund,
  };
}

describe("RefundOrder", () => {
  it("prices the units and records what each line had refunded so far", async () => {
    const { repo, refund } = repoWith(ORDER);
    await new RefundOrder(repo, ledgerWith([SALE])).execute(
      "o1",
      { lines: [{ itemId: "i1", quantity: 1, restock: false }], method: "cash", reason: " Spilled " },
      STAFF,
      NOW,
    );

    expect(refund.mock.calls[0][0]).toMatchObject({
      orderId: "o1",
      date: "2026-10-20",
      method: "cash",
      amount: 100_000,
      vatAmount: 9_091,
      reason: "Spilled",
      expectedRefunded: { i1: 0 },
    });
  });

  it("uses the VAT the sale booked, whatever the rate is today", async () => {
    const { repo, refund } = repoWith(ORDER);
    const atOldRate = {
      ...SALE,
      lines: SALE.lines.map((line) => (line.accountCode === "2200" ? { ...line, credit: 5_000 } : line)),
    };
    await new RefundOrder(repo, ledgerWith([atOldRate])).execute(
      "o1",
      { lines: [{ itemId: "i1", quantity: 1, restock: false }], method: "cash" },
      STAFF,
      NOW,
    );

    expect(refund.mock.calls[0][0].vatAmount).toBe(5_000);
  });

  it("logs the refund and books the money and the restocked cost", async () => {
    const { repo, refund } = repoWith(ORDER);
    await new RefundOrder(repo, ledgerWith([SALE])).execute(
      "o1",
      { lines: [{ itemId: "i2", quantity: 1, restock: true }], method: "card" },
      STAFF,
      NOW,
    );

    const [input, actor, audit, ledger] = refund.mock.calls[0];
    expect(actor).toEqual(STAFF);
    const result = {
      refund: { ...input, id: "r1", number: 1, createdAt: "" },
      order: { ...ORDER, refundedTotal: 200_000 },
      restockedValue: 120_000,
    };
    expect(audit?.(result)).toMatchObject({
      action: "order.refunded",
      changes: [{ field: "refundedTotal", before: "0", after: "200000" }],
    });
    expect(ledger?.(result, { vatRateBps: 1000 }).map((entry) => entry.source)).toEqual([
      "orderReturn",
      "orderReturnCost",
    ]);
  });

  it("refuses an order that isn't completed and paid", async () => {
    const useCase = (order: Order) => new RefundOrder(repoWith(order).repo, ledgerWith([SALE]));
    const lines = [{ itemId: "i1", quantity: 1, restock: false }];

    await expect(
      useCase({ ...ORDER, status: "preparing" }).execute("o1", { lines, method: "cash" }, STAFF, NOW),
    ).rejects.toThrow(ConflictError);
    await expect(
      useCase({ ...ORDER, paymentStatus: "unpaid" }).execute("o1", { lines, method: "cash" }, STAFF, NOW),
    ).rejects.toThrow(ConflictError);
  });

  it("refuses an order whose sale isn't on the books", async () => {
    await expect(
      new RefundOrder(repoWith(ORDER).repo, ledgerWith([])).execute(
        "o1",
        { lines: [{ itemId: "i1", quantity: 1, restock: false }], method: "cash" },
        STAFF,
        NOW,
      ),
    ).rejects.toThrow("isn't on the books");
  });

  it("refuses an unknown order and units that aren't there", async () => {
    await expect(
      new RefundOrder(repoWith(null).repo, ledgerWith([SALE])).execute("o1", { lines: [], method: "cash" }, STAFF, NOW),
    ).rejects.toThrow(NotFoundError);
    await expect(
      new RefundOrder(repoWith(ORDER).repo, ledgerWith([SALE])).execute(
        "o1",
        { lines: [{ itemId: "i1", quantity: 2, restock: false }], method: "cash" },
        STAFF,
        NOW,
      ),
    ).rejects.toThrow(ValidationError);
  });
});

describe("refundPostings", () => {
  it("books no cost entry when nothing went back on the shelf", () => {
    const entries = refundPostings(STAFF)(
      {
        refund: {
          id: "r1",
          number: 1,
          orderId: "o1",
          date: "2026-10-20",
          method: "cash",
          amount: 100_000,
          vatAmount: 9_091,
          lines: [
            {
              orderItemId: "i1",
              name: "Latte",
              kind: "drink",
              quantity: 1,
              amount: 100_000,
              vatAmount: 9_091,
              restocked: false,
            },
          ],
          createdById: STAFF.id,
          createdByName: STAFF.name,
          createdAt: "",
        },
        order: ORDER,
        restockedValue: 0,
      },
      { vatRateBps: 1000 },
    );

    expect(entries.map((entry) => entry.source)).toEqual(["orderReturn"]);
  });
});

describe("SetOrderPayment with refunds on the order", () => {
  it("won't take back a payment that was partly refunded", async () => {
    const { repo } = repoWith({ ...ORDER, refundedTotal: 100_000 });

    await expect(new SetOrderPayment(repo).execute("o1", "unpaid", undefined, STAFF)).rejects.toThrow(
      "can't be taken back",
    );
  });
});
