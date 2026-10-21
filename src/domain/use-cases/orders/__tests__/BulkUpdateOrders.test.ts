import { describe, expect, it, vi } from "vitest";

import { InvalidOrderTransitionError } from "../../../errors/InvalidOrderTransitionError";
import { ValidationError } from "../../../errors/ValidationError";
import { BulkUpdateOrders } from "../BulkUpdateOrders";

import type { Order, OrderStatus, PaymentStatus } from "../../../entities/Order";
import type { IOrderRepository } from "../../../repositories/IOrderRepository";

function order(id: string, status: OrderStatus, paymentStatus: PaymentStatus = "unpaid"): Order {
  return {
    id,
    orderNumber: Number(id.slice(1)),
    userId: "guest",
    customerName: "Sara",
    customerPhone: "0912",
    status,
    serviceType: "takeaway",
    paymentStatus,
    items: [],
    subtotal: 0,
    promoDiscount: 0,
    pointsRedeemed: 0,
    pointsDiscount: 0,
    pointsEarned: 0,
    total: 0,
    placedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function repoWith(orders: Order[]) {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const transition = vi.fn(async (id: string, _from: OrderStatus, to: OrderStatus) => ({
    ...byId.get(id)!,
    status: to,
  }));
  const setPaymentStatus = vi.fn(async (id: string, change: { to: PaymentStatus }) => ({
    ...byId.get(id)!,
    paymentStatus: change.to,
  }));
  const repo = {
    getById: vi.fn(async (id: string) => byId.get(id) ?? null),
    transition,
    setPaymentStatus,
  } as unknown as IOrderRepository;
  return { repo, transition, setPaymentStatus };
}

const STAFF = { id: "staff", name: "Ali" };

describe("BulkUpdateOrders", () => {
  it("serves only the orders being prepared, and reports what changed", async () => {
    const { repo, transition } = repoWith([order("o1", "preparing"), order("o2", "pending"), order("o3", "completed")]);

    const updated = await new BulkUpdateOrders(repo).execute(["o1", "o2", "o3"], { type: "serve" }, STAFF);

    expect(updated.map((o) => o.id)).toEqual(["o1"]);
    expect(transition).toHaveBeenCalledTimes(1);
    expect(transition).toHaveBeenCalledWith(
      "o1",
      "preparing",
      "completed",
      STAFF,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("marks unpaid, live orders paid with the chosen method", async () => {
    const { repo, setPaymentStatus } = repoWith([
      order("o1", "completed"),
      order("o2", "preparing", "paid"),
      order("o3", "cancelled"),
    ]);

    const updated = await new BulkUpdateOrders(repo).execute(
      ["o1", "o2", "o3"],
      { type: "markPaid", paymentMethod: "card" },
      STAFF,
    );

    expect(updated.map((o) => o.id)).toEqual(["o1"]);
    expect(setPaymentStatus).toHaveBeenCalledWith(
      "o1",
      { from: "unpaid", to: "paid", method: "card" },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("cancels what's still in the queue and leaves finished orders alone", async () => {
    const { repo } = repoWith([order("o1", "pending"), order("o2", "preparing"), order("o3", "completed")]);

    const updated = await new BulkUpdateOrders(repo).execute(["o1", "o2", "o3"], { type: "cancel" }, STAFF);

    expect(updated.map((o) => [o.id, o.status])).toEqual([
      ["o1", "cancelled"],
      ["o2", "cancelled"],
    ]);
  });

  it("skips missing ids, duplicates and orders that lost a race", async () => {
    const { repo, transition } = repoWith([order("o1", "pending"), order("o2", "pending")]);
    transition.mockRejectedValueOnce(new InvalidOrderTransitionError("pending", "cancelled"));

    const updated = await new BulkUpdateOrders(repo).execute(["o1", "o1", "o2", "gone"], { type: "cancel" }, STAFF);

    expect(updated.map((o) => o.id)).toEqual(["o2"]);
    expect(transition).toHaveBeenCalledTimes(2);
  });

  it("rethrows anything other than a lost race", async () => {
    const { repo, transition } = repoWith([order("o1", "pending")]);
    transition.mockRejectedValueOnce(new Error("database down"));

    await expect(new BulkUpdateOrders(repo).execute(["o1"], { type: "cancel" }, STAFF)).rejects.toThrow(
      "database down",
    );
  });

  it("refuses an empty or oversized selection", async () => {
    const { repo } = repoWith([]);
    const bulk = new BulkUpdateOrders(repo);

    await expect(bulk.execute([], { type: "serve" }, STAFF)).rejects.toBeInstanceOf(ValidationError);
    const tooMany = Array.from({ length: 101 }, (_, i) => `o${i}`);
    await expect(bulk.execute(tooMany, { type: "serve" }, STAFF)).rejects.toBeInstanceOf(ValidationError);
  });
});
