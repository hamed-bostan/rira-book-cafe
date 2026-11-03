import { describe, expect, it } from "vitest";

import {
  ORDER_STATUSES,
  canChangeOrderLines,
  canChangeOrderService,
  canLowerOrderItem,
  canTransition,
  canWriteOffOrder,
  isGuestCancellable,
  isOrderOf,
  isStaffCancellable,
  nextOrderStatus,
  orderGuestId,
  orderSubtotal,
} from "../Order";

describe("order workflow", () => {
  it("walks forward one step at a time: placed → preparing → served", () => {
    expect(nextOrderStatus("pending")).toBe("preparing");
    expect(nextOrderStatus("preparing")).toBe("completed");
    expect(nextOrderStatus("completed")).toBeNull();
    expect(nextOrderStatus("cancelled")).toBeNull();
  });

  it("refuses skipping steps and going backwards", () => {
    expect(canTransition("pending", "completed")).toBe(false);
    expect(canTransition("preparing", "pending")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });

  it("lets staff cancel until the order is served, and the guest only while pending", () => {
    expect(ORDER_STATUSES.filter(isStaffCancellable)).toEqual(["pending", "preparing"]);
    expect(ORDER_STATUSES.filter(isGuestCancellable)).toEqual(["pending"]);
  });

  it("writes off only a served order nobody paid for, without opening that step to anyone else", () => {
    expect(ORDER_STATUSES.filter((status) => canWriteOffOrder({ status, paymentStatus: "unpaid" }))).toEqual([
      "completed",
    ]);
    expect(canWriteOffOrder({ status: "completed", paymentStatus: "paid" })).toBe(false);
    expect(canWriteOffOrder({ status: "completed", paymentStatus: "refunded" })).toBe(false);
    // The workflow table still refuses it: a served order is otherwise final.
    expect(canTransition("completed", "cancelled")).toBe(false);
  });

  it("sums lines in whole Toman", () => {
    expect(
      orderSubtotal([
        { unitPrice: 185000, quantity: 2 },
        { unitPrice: 95000, quantity: 1 },
      ]),
    ).toBe(465000);
  });
});

describe("changing an order after it's placed", () => {
  it("changes lines only while it's being worked and nothing is paid", () => {
    const unpaid = ORDER_STATUSES.filter((status) => canChangeOrderLines({ status, paymentStatus: "unpaid" }));
    expect(unpaid).toEqual(["pending", "preparing"]);
    expect(canChangeOrderLines({ status: "pending", paymentStatus: "paid" })).toBe(false);
    expect(canChangeOrderLines({ status: "preparing", paymentStatus: "refunded" })).toBe(false);
  });

  it("moves the table or the service until it's served, paid or not", () => {
    expect(ORDER_STATUSES.filter((status) => canChangeOrderService({ status }))).toEqual(["pending", "preparing"]);
  });

  it("keeps a line that has gone out to the guest", () => {
    expect(canLowerOrderItem({ servedAt: undefined })).toBe(true);
    expect(canLowerOrderItem({ servedAt: "2026-11-03T10:00:00.000Z" })).toBe(false);
  });
});

describe("whose order it is", () => {
  it("is the account that placed it", () => {
    expect(orderGuestId({ userId: "09120000004", customerPhone: "0912 000 0004" })).toBe("09120000004");
    expect(isOrderOf({ userId: "09120000004", customerPhone: "" }, "09120000005")).toBe(false);
  });

  it("is the phone a counter sale was rung up for, however it was typed", () => {
    const sale = { userId: undefined, customerPhone: "+98 912 345 6789" };
    expect(orderGuestId(sale)).toBe("09123456789");
    expect(isOrderOf(sale, "09123456789")).toBe(true);
    expect(isOrderOf(sale, "09120000004")).toBe(false);
  });

  it("is nobody's for a counter sale without a phone", () => {
    expect(orderGuestId({ userId: undefined, customerPhone: "" })).toBeNull();
    expect(orderGuestId({ userId: undefined, customerPhone: "12" })).toBeNull();
    expect(isOrderOf({ userId: undefined, customerPhone: "" }, "")).toBe(false);
  });
});
