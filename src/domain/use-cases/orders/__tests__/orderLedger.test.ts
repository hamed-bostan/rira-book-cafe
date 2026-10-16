import { describe, expect, it, vi } from "vitest";

import { DEFAULT_VAT_RATE_BPS } from "../../../entities/Ledger";
import { ConflictError } from "../../../errors/ConflictError";
import { ValidationError } from "../../../errors/ValidationError";
import { paymentPostings, statusPostings } from "../orderLedger";
import { SetOrderPayment } from "../SetOrderPayment";

import type { Order } from "../../../entities/Order";
import type { IOrderRepository } from "../../../repositories/IOrderRepository";

const STAFF = { id: "staff", name: "Ali" };
const SETTINGS = { vatRateBps: DEFAULT_VAT_RATE_BPS };
// 2026-10-16 01:00 in Tehran is still the 15th in UTC — postings use the cafe's day.
const NOW = new Date("2026-10-15T21:30:00Z");

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: 7,
    userId: "guest",
    customerName: "Sara",
    customerPhone: "0912",
    status: "ready",
    serviceType: "dineIn",
    paymentStatus: "unpaid",
    items: [
      { id: "i1", productId: "p1", kind: "drink", name: "Latte", imageUrl: "", unitPrice: 110_000, unitCost: 40_000, stockTracked: true, quantity: 2 },
      { id: "i2", productId: "p2", kind: "book", name: "Novel", imageUrl: "", unitPrice: 330_000, unitCost: 220_000, stockTracked: true, quantity: 1 },
    ],
    subtotal: 550_000,
    total: 550_000,
    placedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("statusPostings", () => {
  it("books the sale and its cost when an order completes, on the cafe's day", () => {
    const entries = statusPostings(STAFF, NOW)(order({ status: "completed" }), SETTINGS);
    expect(entries.map((entry) => entry.source)).toEqual(["orderSale", "orderCost"]);
    expect(entries.every((entry) => entry.date === "2026-10-16")).toBe(true);
    expect(entries[1].lines[0]).toMatchObject({ accountCode: "5100", debit: 300_000 });
  });

  it("books only the sale when no item has a cost", () => {
    const noCost = order({ status: "completed", items: order().items.map((item) => ({ ...item, unitCost: undefined })) });
    expect(statusPostings(STAFF, NOW)(noCost, SETTINGS).map((entry) => entry.source)).toEqual(["orderSale"]);
  });

  it("refunds a paid order that was cancelled through the method it was paid by", () => {
    const [refund] = statusPostings(STAFF, NOW)(
      order({ status: "cancelled", paymentStatus: "refunded", paymentMethod: "card" }),
      SETTINGS,
    );
    expect(refund.source).toBe("orderRefund");
    expect(refund.lines).toContainEqual(expect.objectContaining({ accountCode: "1120", credit: 550_000 }));
  });

  it("books nothing for an unpaid cancellation, a legacy refund, or a free order", () => {
    const hook = statusPostings(STAFF, NOW);
    expect(hook(order({ status: "cancelled" }), SETTINGS)).toEqual([]);
    expect(hook(order({ status: "cancelled", paymentStatus: "refunded" }), SETTINGS)).toEqual([]);
    expect(hook(order({ status: "completed", total: 0, subtotal: 0 }), SETTINGS)).toEqual([]);
    expect(hook(order({ status: "preparing" }), SETTINGS)).toEqual([]);
  });
});

describe("paymentPostings", () => {
  it("puts the money in the method's account", () => {
    const [entry] = paymentPostings(order(), STAFF, NOW)(order({ paymentStatus: "paid", paymentMethod: "online" }), SETTINGS);
    expect(entry.lines[0]).toMatchObject({ accountCode: "1130", debit: 550_000 });
  });

  it("reverses an unmarked payment through the method it was taken by", () => {
    const before = order({ paymentStatus: "paid", paymentMethod: "cash" });
    const [entry] = paymentPostings(before, STAFF, NOW)(order({ paymentStatus: "unpaid" }), SETTINGS);
    expect(entry.source).toBe("orderPaymentReversal");
    expect(entry.lines).toContainEqual(expect.objectContaining({ accountCode: "1110", credit: 550_000 }));
  });
});

describe("SetOrderPayment", () => {
  function repoWith(current: Order) {
    const setPaymentStatus = vi.fn(async () => current);
    const repo = { getById: vi.fn(async () => current), setPaymentStatus } as unknown as IOrderRepository;
    return { repo, setPaymentStatus };
  }

  it("guards on the status it read and passes the method", async () => {
    const { repo, setPaymentStatus } = repoWith(order());
    await new SetOrderPayment(repo).execute("o1", "paid", "transfer", STAFF);
    expect(setPaymentStatus).toHaveBeenCalledWith(
      "o1",
      { from: "unpaid", to: "paid", method: "transfer" },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("needs a method to mark paid", async () => {
    const { repo } = repoWith(order());
    await expect(new SetOrderPayment(repo).execute("o1", "paid", undefined, STAFF)).rejects.toThrow(ValidationError);
  });

  it("won't touch a refunded order or take payment for a cancelled one", async () => {
    await expect(
      new SetOrderPayment(repoWith(order({ status: "cancelled", paymentStatus: "refunded" })).repo).execute("o1", "unpaid", undefined, STAFF),
    ).rejects.toThrow(ConflictError);
    await expect(
      new SetOrderPayment(repoWith(order({ status: "cancelled" })).repo).execute("o1", "paid", "cash", STAFF),
    ).rejects.toThrow(ConflictError);
  });
});
