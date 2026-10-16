import { describe, expect, it, vi } from "vitest";

import { InvalidOrderTransitionError } from "../../../errors/InvalidOrderTransitionError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { CancelOwnOrder, ChangeOrderStatus } from "../ChangeOrderStatus";

import type { Order, OrderStatus } from "../../../entities/Order";
import type { IOrderRepository } from "../../../repositories/IOrderRepository";

function order(status: OrderStatus, userId = "guest"): Order {
  return {
    id: "o1",
    orderNumber: 7,
    userId,
    customerName: "Sara",
    customerPhone: "0912",
    status,
    serviceType: "takeaway",
    paymentStatus: "unpaid",
    items: [],
    subtotal: 0,
    total: 0,
    placedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function repoWith(current: Order) {
  const transition = vi.fn(
    async (_id: string, _from: OrderStatus, to: OrderStatus, _actor: unknown, _audit?: (saved: Order) => unknown) => ({
      ...current,
      status: to,
    }),
  );
  const repo = { getById: vi.fn(async () => current), transition } as unknown as IOrderRepository;
  return { repo, transition };
}

const STAFF = { id: "staff", name: "Ali" };

describe("ChangeOrderStatus", () => {
  it("passes the status it read, so a concurrent change can't be overwritten", async () => {
    const { repo, transition } = repoWith(order("accepted"));
    await new ChangeOrderStatus(repo).execute("o1", "preparing", STAFF);
    expect(transition).toHaveBeenCalledWith("o1", "accepted", "preparing", STAFF, expect.any(Function));
  });

  it("audits the change as order #number", async () => {
    const { repo, transition } = repoWith(order("ready"));
    await new ChangeOrderStatus(repo).execute("o1", "completed", STAFF);
    const audit = transition.mock.calls[0][4];
    expect(audit?.(order("completed"))).toMatchObject({ action: "order.stageChanged", entityLabel: "#7" });
  });

  it("refuses transitions the workflow doesn't allow", async () => {
    const { repo, transition } = repoWith(order("ready"));
    await expect(new ChangeOrderStatus(repo).execute("o1", "cancelled", STAFF)).rejects.toThrow(InvalidOrderTransitionError);
    expect(transition).not.toHaveBeenCalled();
  });
});

describe("CancelOwnOrder", () => {
  it("cancels the guest's own pending order", async () => {
    const { repo } = repoWith(order("pending"));
    const result = await new CancelOwnOrder(repo).execute("o1", { id: "guest", name: "Sara" });
    expect(result.status).toBe("cancelled");
  });

  it("hides other guests' orders and refuses once accepted", async () => {
    await expect(new CancelOwnOrder(repoWith(order("pending", "other")).repo).execute("o1", { id: "guest", name: "Sara" })).rejects.toThrow(
      NotFoundError,
    );
    await expect(new CancelOwnOrder(repoWith(order("accepted")).repo).execute("o1", { id: "guest", name: "Sara" })).rejects.toThrow(
      InvalidOrderTransitionError,
    );
  });
});
