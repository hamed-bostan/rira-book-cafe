import { describe, expect, it } from "vitest";

import {
  ORDER_STATUSES,
  canTransition,
  canWriteOffOrder,
  isGuestCancellable,
  isStaffCancellable,
  nextOrderStatus,
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
