import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { SetOrderItemServed } from "../SetOrderItemServed";

import type { Order, OrderStatus } from "../../../entities/Order";
import type { IOrderRepository } from "../../../repositories/IOrderRepository";

function order(status: OrderStatus, servedAt?: string): Order {
  return {
    id: "o1",
    orderNumber: 7,
    userId: "guest",
    customerName: "Sara",
    customerPhone: "0912",
    status,
    serviceType: "dineIn",
    tableLabel: "4",
    paymentStatus: "unpaid",
    items: [
      { id: "i1", productId: "p1", kind: "drink", name: "Latte", imageUrl: "", unitPrice: 100, quantity: 1, servedAt },
    ],
    subtotal: 100,
    promoDiscount: 0,
    pointsRedeemed: 0,
    pointsDiscount: 0,
    pointsEarned: 0,
    total: 100,
    placedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function repoWith(current: Order) {
  const setItemServed = vi.fn(async () => current);
  const repo = { getById: vi.fn(async () => current), setItemServed } as unknown as IOrderRepository;
  return { repo, setItemServed };
}

describe("SetOrderItemServed", () => {
  it("marks a line served while the order is being worked", async () => {
    const { repo, setItemServed } = repoWith(order("preparing"));
    await new SetOrderItemServed(repo).execute("o1", "i1", true);
    expect(setItemServed).toHaveBeenCalledWith("o1", "i1", true);
  });

  it("takes a mark back", async () => {
    const { repo, setItemServed } = repoWith(order("preparing", new Date(0).toISOString()));
    await new SetOrderItemServed(repo).execute("o1", "i1", false);
    expect(setItemServed).toHaveBeenCalledWith("o1", "i1", false);
  });

  it("is a no-op when the line is already in that state", async () => {
    const { repo, setItemServed } = repoWith(order("preparing", new Date(0).toISOString()));
    await new SetOrderItemServed(repo).execute("o1", "i1", true);
    expect(setItemServed).not.toHaveBeenCalled();
  });

  it("refuses before the order is taken and after it's finished", async () => {
    for (const status of ["pending", "completed", "cancelled"] as const) {
      const { repo, setItemServed } = repoWith(order(status));
      await expect(new SetOrderItemServed(repo).execute("o1", "i1", true)).rejects.toThrow(ConflictError);
      expect(setItemServed).not.toHaveBeenCalled();
    }
  });

  it("reports an unknown line as not found", async () => {
    const { repo } = repoWith(order("preparing"));
    await expect(new SetOrderItemServed(repo).execute("o1", "nope", true)).rejects.toThrow(NotFoundError);
  });
});
