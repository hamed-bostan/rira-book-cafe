import { describe, expect, it } from "vitest";

import {
  counterOrderSchema,
  orderChangeSchema,
  orderPaymentSchema,
  orderRefundSchema,
  orderWriteOffSchema,
  placeOrderSchema,
} from "../order-schema";

import { messagesAt } from "./zod-issues";

describe("placeOrderSchema", () => {
  it("requires a table for dine-in", () => {
    const result = placeOrderSchema.safeParse({ serviceType: "dineIn", items: [{ productId: "p1", quantity: 1 }] });
    expect(result.error?.issues.map((issue) => issue.message)).toContain("tableRequired");
  });

  it("trims notes and turns blanks into undefined", () => {
    const parsed = placeOrderSchema.parse({
      serviceType: "dineIn",
      tableLabel: " 4 ",
      note: "  ",
      items: [{ productId: "p1", quantity: 2, note: " oat milk " }],
    });
    expect(parsed).toMatchObject({ tableLabel: "4", note: undefined, items: [{ note: "oat milk" }] });
  });

  it("rejects empty orders and fractional quantities", () => {
    expect(placeOrderSchema.safeParse({ serviceType: "takeaway", items: [] }).success).toBe(false);
    expect(
      placeOrderSchema.safeParse({ serviceType: "takeaway", items: [{ productId: "p1", quantity: 1.5 }] }).success,
    ).toBe(false);
  });
});

// Only the gateway's callback books an online payment, once the gateway confirmed
// the money: staff can't say a guest paid online, whichever way they record it.
describe("a payment staff record", () => {
  it("is cash, card or a transfer when marking an order paid", () => {
    for (const paymentMethod of ["cash", "card", "transfer"]) {
      expect(orderPaymentSchema.safeParse({ paymentStatus: "paid", paymentMethod }).success).toBe(true);
    }
  });

  it("is never online on an order", () => {
    expect(
      messagesAt(orderPaymentSchema.safeParse({ paymentStatus: "paid", paymentMethod: "online" }), "paymentMethod"),
    ).toEqual(["methodInvalid"]);
    expect(
      messagesAt(
        orderPaymentSchema.safeParse({
          paymentStatus: "paid",
          paymentParts: [
            { method: "cash", amount: 1000 },
            { method: "online", amount: 2000 },
          ],
        }),
        "paymentParts.1.method",
      ),
    ).toEqual(["methodInvalid"]);
  });

  it("needs the guest's phone on every counter sale, and takes their name only when given", () => {
    const sale = { items: [{ productId: "p1", quantity: 1 }], serviceType: "takeaway" };
    expect(messagesAt(counterOrderSchema.safeParse(sale), "customerPhone")).toEqual(["phoneRequired"]);
    expect(messagesAt(counterOrderSchema.safeParse({ ...sale, customerPhone: " " }), "customerPhone")).toContain(
      "phoneRequired",
    );
    expect(messagesAt(counterOrderSchema.safeParse({ ...sale, customerPhone: "0912" }), "customerPhone")).toEqual([
      "phoneInvalid",
    ]);
    expect(counterOrderSchema.parse({ ...sale, customerPhone: " 0912 345 6789 ", customerName: "  " })).toMatchObject({
      customerPhone: "0912 345 6789",
      customerName: undefined,
    });
  });

  it("is never online on a counter sale", () => {
    const sale = { items: [{ productId: "p1", quantity: 1 }], serviceType: "takeaway", customerPhone: "09123456789" };
    expect(counterOrderSchema.safeParse({ ...sale, paymentParts: [{ method: "cash", amount: 1000 }] }).success).toBe(
      true,
    );
    expect(
      messagesAt(
        counterOrderSchema.safeParse({ ...sale, paymentParts: [{ method: "online", amount: 1000 }] }),
        "paymentParts.0.method",
      ),
    ).toEqual(["methodInvalid"]);
  });

  it("gives a write-off's reason trimmed, or none, and bounds it", () => {
    expect(orderWriteOffSchema.parse({ reason: " Walked out " })).toEqual({ reason: "Walked out" });
    expect(orderWriteOffSchema.parse({ reason: "  " })).toEqual({ reason: undefined });
    expect(orderWriteOffSchema.parse({})).toEqual({ reason: undefined });
    expect(messagesAt(orderWriteOffSchema.safeParse({ reason: "x".repeat(201) }), "reason")).toEqual(["noteTooLong"]);
  });

  it("still lets an order paid online be refunded back through the gateway", () => {
    expect(
      orderRefundSchema.safeParse({ lines: [{ itemId: "i1", quantity: 1, restock: false }], method: "online" }).success,
    ).toBe(true);
  });
});

describe("orderChangeSchema", () => {
  it("takes a round, lowered lines and a move together, trimming notes and the table", () => {
    expect(
      orderChangeSchema.parse({
        version: "2026-11-03T09:00:00.000Z",
        add: [{ productId: "p1", quantity: 2, note: " oat milk " }],
        lines: [{ itemId: "i1", quantity: 0 }],
        serviceType: "dineIn",
        tableLabel: " 9 ",
      }),
    ).toMatchObject({ add: [{ note: "oat milk" }], lines: [{ quantity: 0 }], tableLabel: "9" });
  });

  it("needs something to change", () => {
    expect(messagesAt(orderChangeSchema.safeParse({ version: "v" }), "add")).toEqual(["changeRequired"]);
    expect(messagesAt(orderChangeSchema.safeParse({ lines: [] }), "add")).toEqual(["changeRequired"]);
  });

  it("refuses an empty round, a negative or fractional quantity, and dine-in without a table", () => {
    expect(messagesAt(orderChangeSchema.safeParse({ add: [] }), "add")).toEqual(["itemsRequired"]);
    expect(
      messagesAt(orderChangeSchema.safeParse({ lines: [{ itemId: "i1", quantity: -1 }] }), "lines.0.quantity"),
    ).toEqual(["quantityWhole"]);
    expect(
      messagesAt(orderChangeSchema.safeParse({ lines: [{ itemId: "i1", quantity: 1.5 }] }), "lines.0.quantity"),
    ).toEqual(["quantityWhole"]);
    expect(messagesAt(orderChangeSchema.safeParse({ serviceType: "dineIn", tableLabel: " " }), "tableLabel")).toEqual([
      "tableRequired",
    ]);
  });
});
