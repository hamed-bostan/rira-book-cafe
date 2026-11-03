import { describe, expect, it } from "vitest";

import {
  counterOrderSchema,
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

  it("is never online on a counter sale", () => {
    const sale = { items: [{ productId: "p1", quantity: 1 }], serviceType: "takeaway", customerName: "Walk-in" };
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
