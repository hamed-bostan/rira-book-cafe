import { describe, expect, it } from "vitest";

import { pointsToClawBack, priceRefundLines } from "../OrderRefund";

import type { Order, OrderItem } from "../Order";

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "i1",
    productId: "p1",
    kind: "drink",
    name: "Latte",
    imageUrl: "",
    unitPrice: 100_000,
    quantity: 1,
    ...overrides,
  };
}

/** A two-line order: three lattes, and a VAT-exempt book. */
const ORDER: Pick<Order, "items" | "total"> = {
  items: [
    item({ id: "i1", quantity: 3 }),
    item({ id: "i2", kind: "book", name: "Novel", unitPrice: 200_000, taxExempt: true }),
  ],
  total: 500_000,
};

describe("priceRefundLines", () => {
  it("prices a line at its share of what was paid, with its share of the sale's VAT", () => {
    const priced = priceRefundLines(ORDER, 27_272, [{ itemId: "i1", quantity: 1, restock: false }]);

    expect(priced.lines).toEqual([
      {
        orderItemId: "i1",
        name: "Latte",
        kind: "drink",
        quantity: 1,
        amount: 100_000,
        vatAmount: 9_090,
        serviceCharge: 0,
        serviceChargeVat: 0,
        restocked: false,
      },
    ]);
  });

  it("gives a VAT-exempt line no VAT, however much the sale booked", () => {
    const priced = priceRefundLines(ORDER, 27_272, [{ itemId: "i2", quantity: 1, restock: true }]);

    expect(priced.lines?.[0]).toMatchObject({ amount: 200_000, vatAmount: 0, restocked: true });
  });

  it("shares a discount across the lines", () => {
    const discounted = { ...ORDER, total: 400_000 };
    const priced = priceRefundLines(discounted, 0, [{ itemId: "i2", quantity: 1, restock: true }]);

    expect(priced.lines?.[0].amount).toBe(160_000);
  });

  it("adds up to exactly the line's total when it's refunded a unit at a time", () => {
    const order: Pick<Order, "items" | "total"> = { items: [item({ quantity: 3 })], total: 100_000 };
    let refundedQuantity = 0;
    let amount = 0;
    let vatAmount = 0;
    for (let unit = 0; unit < 3; unit += 1) {
      const current = { ...order, items: [item({ quantity: 3, refundedQuantity })] };
      const [line] = priceRefundLines(current, 9_091, [{ itemId: "i1", quantity: 1, restock: false }]).lines ?? [];
      amount += line.amount;
      vatAmount += line.vatAmount;
      refundedQuantity += 1;
    }

    expect(amount).toBe(100_000);
    expect(vatAmount).toBe(9_091);
  });

  it("refuses units that aren't left on the line", () => {
    const refunded = { ...ORDER, items: [item({ quantity: 3, refundedQuantity: 3 })] };

    expect(priceRefundLines(refunded, 0, [{ itemId: "i1", quantity: 1, restock: false }]).problem).toBe(
      "refundQuantityInvalid",
    );
    expect(priceRefundLines(ORDER, 0, [{ itemId: "i1", quantity: 4, restock: false }]).problem).toBe(
      "refundQuantityInvalid",
    );
    expect(priceRefundLines(ORDER, 0, [{ itemId: "i1", quantity: 1.5, restock: false }]).problem).toBe(
      "refundQuantityInvalid",
    );
  });

  it("refuses an empty refund, an unknown line and a line picked twice", () => {
    expect(priceRefundLines(ORDER, 0, []).problem).toBe("refundLinesRequired");
    expect(priceRefundLines(ORDER, 0, [{ itemId: "nope", quantity: 1, restock: false }]).problem).toBe(
      "refundLineUnknown",
    );
    expect(
      priceRefundLines(ORDER, 0, [
        { itemId: "i1", quantity: 1, restock: false },
        { itemId: "i1", quantity: 1, restock: false },
      ]).problem,
    ).toBe("refundLinesRequired");
  });
});

describe("pointsToClawBack", () => {
  it("takes back the refund's share of what the order earned, rounded up", () => {
    expect(pointsToClawBack({ pointsEarned: 10, total: 300_000 }, 100_000)).toBe(4);
    expect(pointsToClawBack({ pointsEarned: 10, total: 300_000 }, 300_000)).toBe(10);
  });

  it("takes nothing from an order that earned nothing", () => {
    expect(pointsToClawBack({ pointsEarned: 0, total: 300_000 }, 100_000)).toBe(0);
  });
});
