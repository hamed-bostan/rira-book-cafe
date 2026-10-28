import { describe, expect, it } from "vitest";

import { isLateOrder, kitchenLanes, kitchenWaitTone, lateOrderCount, minutesWaiting } from "../Kitchen";

import type { Order, OrderItem, OrderStatus } from "../Order";

function item(id: string, kind: OrderItem["kind"]): OrderItem {
  return { id, productId: id, kind, name: id, imageUrl: "", unitPrice: 1, quantity: 1 };
}

function order(id: string, status: OrderStatus, placedAt: string, items: OrderItem[]): Order {
  return {
    id,
    orderNumber: 1,
    userId: "g",
    customerName: "",
    customerPhone: "",
    status,
    serviceType: "dineIn",
    tableLabel: "4",
    paymentStatus: "unpaid",
    items,
    subtotal: 0,
    promoDiscount: 0,
    pointsRedeemed: 0,
    pointsDiscount: 0,
    pointsEarned: 0,
    total: 0,
    placedAt,
    updatedAt: placedAt,
  };
}

const ORDERS = [
  order("late", "preparing", "2026-10-20T09:00:00Z", [item("latte", "drink"), item("cake", "food")]),
  order("early", "preparing", "2026-10-20T08:00:00Z", [item("tea", "drink")]),
  order("new", "pending", "2026-10-20T09:30:00Z", [item("novel", "book")]),
];

describe("kitchenLanes", () => {
  it("sorts orders into lanes, oldest first", () => {
    const lanes = kitchenLanes(ORDERS);
    expect(lanes.making.map((o) => o.id)).toEqual(["early", "late"]);
    expect(lanes.new.map((o) => o.id)).toEqual(["new"]);
  });

  it("keeps every line of an order — drinks, food and books alike", () => {
    const { making } = kitchenLanes(ORDERS);
    expect(making.map((o) => o.items.map((i) => i.id))).toEqual([["tea"], ["latte", "cake"]]);
  });

  it("leaves served and cancelled orders off the board", () => {
    const lanes = kitchenLanes([
      order("served", "completed", "2026-10-20T06:00:00Z", [item("tea", "drink")]),
      order("gone", "cancelled", "2026-10-20T06:30:00Z", [item("cake", "food")]),
    ]);
    expect([...lanes.new, ...lanes.making]).toEqual([]);
  });
});

describe("minutesWaiting", () => {
  it("counts whole minutes since the order was placed", () => {
    expect(minutesWaiting({ placedAt: "2026-10-20T09:00:00Z" }, new Date("2026-10-20T09:15:59Z"))).toBe(15);
  });

  it("never goes below zero when the clocks disagree", () => {
    expect(minutesWaiting({ placedAt: "2026-10-20T09:01:00Z" }, new Date("2026-10-20T09:00:00Z"))).toBe(0);
  });
});

describe("kitchenWaitTone", () => {
  it("stays neutral under ten minutes", () => {
    expect(kitchenWaitTone(0)).toBe("neutral");
    expect(kitchenWaitTone(9)).toBe("neutral");
  });

  it("warns from ten minutes", () => {
    expect(kitchenWaitTone(10)).toBe("warning");
    expect(kitchenWaitTone(14)).toBe("warning");
  });

  it("is late from fifteen minutes", () => {
    expect(kitchenWaitTone(15)).toBe("late");
    expect(kitchenWaitTone(65)).toBe("late");
  });
});

describe("late orders", () => {
  const now = new Date("2026-10-20T09:30:00Z");

  it("marks an order late once it has waited fifteen minutes", () => {
    expect(isLateOrder({ placedAt: "2026-10-20T09:15:00Z" }, now)).toBe(true);
    expect(isLateOrder({ placedAt: "2026-10-20T09:15:01Z" }, now)).toBe(false);
  });

  it("counts the late orders in a lane", () => {
    const lane = [
      { placedAt: "2026-10-20T08:00:00Z" },
      { placedAt: "2026-10-20T09:10:00Z" },
      { placedAt: "2026-10-20T09:25:00Z" },
    ];
    expect(lateOrderCount(lane, now)).toBe(2);
    expect(lateOrderCount([], now)).toBe(0);
  });
});
