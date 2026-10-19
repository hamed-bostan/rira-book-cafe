import { describe, expect, it } from "vitest";

import {
  ORDER_STATUSES,
  canTransition,
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

  it("sums lines in whole Toman", () => {
    expect(
      orderSubtotal([
        { unitPrice: 185000, quantity: 2 },
        { unitPrice: 95000, quantity: 1 },
      ]),
    ).toBe(465000);
  });
});
