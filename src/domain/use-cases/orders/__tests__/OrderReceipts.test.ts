import { describe, expect, it, vi } from "vitest";

import { GetOrderReceipt, GetOwnOrderReceipt } from "../OrderReceipts";

import type { Order } from "../../../entities/Order";
import type { OrderRefund } from "../../../entities/OrderRefund";

const ORDER = {
  id: "o1",
  orderNumber: 42,
  userId: undefined,
  customerPhone: "0912 345 6789",
  total: 110_000,
  paymentParts: [],
  items: [{ id: "i1", kind: "drink", name: "Latte", unitPrice: 110_000, unitCost: 30_000, quantity: 1 }],
} as unknown as Order;

function sources(order: Order | null, refunds: OrderRefund[] = []) {
  return {
    orders: { getById: vi.fn(async () => order), listRefunds: vi.fn(async () => refunds) },
    ledger: { getSettings: vi.fn(async () => ({ vatRateBps: 1000 })) },
  };
}

describe("receipts", () => {
  it("prints any order's receipt for staff, costs and all", async () => {
    const receipt = await new GetOrderReceipt(sources(ORDER)).execute("o1");

    expect(receipt).toMatchObject({ vatRateBps: 1000, vatIncluded: 10_000 });
    expect(receipt?.order.items[0].unitCost).toBe(30_000);
    expect(await new GetOrderReceipt(sources(null)).execute("o1")).toBeNull();
  });

  it("gives the guest their own — a counter sale rung up for their phone too — without the costs", async () => {
    const receipt = await new GetOwnOrderReceipt(sources(ORDER)).execute("o1", "09123456789");

    expect(receipt?.order.id).toBe("o1");
    expect(receipt?.order.items[0]).not.toHaveProperty("unitCost");
  });

  it("reads someone else's order as missing", async () => {
    expect(await new GetOwnOrderReceipt(sources(ORDER)).execute("o1", "09120000004")).toBeNull();
    const placed = { ...ORDER, userId: "09120000004" } as Order;
    expect(await new GetOwnOrderReceipt(sources(placed)).execute("o1", "09123456789")).toBeNull();
  });
});
