import { describe, expect, it } from "vitest";

import { kitchenLanes, minutesWaiting } from "../Kitchen";

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
  order("early", "accepted", "2026-10-20T08:00:00Z", [item("tea", "drink")]),
  order("new", "pending", "2026-10-20T09:30:00Z", [item("novel", "book")]),
  order("done", "ready", "2026-10-20T07:00:00Z", [item("toast", "food")]),
];

describe("kitchenLanes", () => {
  it("sorts orders into lanes, oldest first", () => {
    const lanes = kitchenLanes(ORDERS, "all");
    expect(lanes.making.map((o) => o.id)).toEqual(["early", "late"]);
    expect(lanes.new.map((o) => o.id)).toEqual(["new"]);
    expect(lanes.ready.map((o) => o.id)).toEqual(["done"]);
  });

  it("shows a station only its own lines, and drops orders with none", () => {
    const bar = kitchenLanes(ORDERS, "bar");
    expect(bar.making.map((o) => o.items.map((i) => i.id))).toEqual([["tea"], ["latte"]]);
    expect(bar.new).toEqual([]);
    expect(bar.ready).toEqual([]);
    expect(kitchenLanes(ORDERS, "kitchen").ready.map((o) => o.id)).toEqual(["done"]);
  });
});

describe("minutesWaiting", () => {
  it("counts whole minutes since the order was placed", () => {
    expect(minutesWaiting({ placedAt: "2026-10-20T09:00:00Z" }, new Date("2026-10-20T09:15:59Z"))).toBe(15);
  });
});
