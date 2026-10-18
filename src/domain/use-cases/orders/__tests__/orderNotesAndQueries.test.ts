import { describe, expect, it, vi } from "vitest";

import { hasAdminOrderFilters, type OrderStatusCounts } from "../../../entities/AdminOrderFilters";
import {
  canServeItems,
  isActiveOrder,
  itemServiceState,
  orderItemCount,
  servedLineCount,
  withoutCosts,
  type Order,
  type OrderItem,
} from "../../../entities/Order";
import { MAX_ORDER_NOTE_LENGTH, type OrderNote } from "../../../entities/OrderNote";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { AddOrderNote } from "../AddOrderNote";
import { ListOrderNotes } from "../ListOrderNotes";
import {
  GetOrderById,
  GetOrderStatusCounts,
  GetOwnOrder,
  ListOrders,
  ListOrderStatusEvents,
  ListOwnOrders,
} from "../OrderQueries";

import type { OrderStatusEvent } from "../../../entities/OrderStatusEvent";
import type { IOrderNoteRepository } from "../../../repositories/IOrderNoteRepository";
import type { IOrderRepository } from "../../../repositories/IOrderRepository";

const AUTHOR = { id: "s1", name: "Support" };

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "i1",
    productId: "p1",
    kind: "drink",
    name: "Latte",
    imageUrl: "",
    unitPrice: 100,
    quantity: 2,
    ...overrides,
  };
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: 42,
    userId: "g1",
    customerName: "Sara",
    customerPhone: "0912",
    status: "pending",
    serviceType: "takeaway",
    paymentStatus: "unpaid",
    items: [item()],
    subtotal: 200,
    promoDiscount: 0,
    pointsRedeemed: 0,
    pointsDiscount: 0,
    pointsEarned: 0,
    total: 200,
    placedAt: "",
    updatedAt: "",
    ...overrides,
  };
}

type OrdersFake = {
  repo: IOrderRepository;
  listPage: ReturnType<typeof vi.fn<IOrderRepository["listPage"]>>;
  listStatusEvents: ReturnType<typeof vi.fn<IOrderRepository["listStatusEvents"]>>;
};

const COUNTS: OrderStatusCounts = {
  pending: 1,
  accepted: 0,
  preparing: 2,
  ready: 0,
  completed: 5,
  cancelled: 1,
  active: 3,
};
const EVENT: OrderStatusEvent = {
  id: "ev1",
  orderId: "o1",
  from: null,
  to: "pending",
  actorId: "g1",
  actorName: "Sara",
  at: "",
};

function orders(rows: Order[]): OrdersFake {
  const listPage = vi.fn<IOrderRepository["listPage"]>(async (_filters, page) => ({
    items: rows,
    total: rows.length,
    page: page.page,
    pageSize: page.pageSize,
  }));
  const listStatusEvents = vi.fn<IOrderRepository["listStatusEvents"]>(async () => [EVENT]);
  const repo = {
    getById: vi.fn(async (id: string) => rows.find((row) => row.id === id) ?? null),
    listForUser: vi.fn(async (userId: string) => rows.filter((row) => row.userId === userId)),
    listPage,
    countByStatus: vi.fn(async () => COUNTS),
    listStatusEvents,
  } as unknown as IOrderRepository;
  return { repo, listPage, listStatusEvents };
}

function notes(): { repo: IOrderNoteRepository; create: ReturnType<typeof vi.fn<IOrderNoteRepository["create"]>> } {
  const create = vi.fn<IOrderNoteRepository["create"]>(async (input): Promise<OrderNote> => ({
    ...input,
    id: "n1",
    createdAt: "",
  }));
  const repo: IOrderNoteRepository = {
    listForOrder: vi.fn(async (orderId: string): Promise<OrderNote[]> => [
      { id: "n1", orderId, authorId: "s1", authorName: "Support", body: "hi", createdAt: "" },
    ]),
    listForOrders: vi.fn(async () => []),
    create,
  };
  return { repo, create };
}

describe("AddOrderNote", () => {
  it("trims the note and snapshots the author", async () => {
    const { repo, create } = notes();
    const note = await new AddOrderNote(repo, orders([order()]).repo).execute("o1", "  oat milk instead  ", AUTHOR);
    expect(create).toHaveBeenCalledWith({
      orderId: "o1",
      authorId: "s1",
      authorName: "Support",
      body: "oat milk instead",
    });
    expect(note.id).toBe("n1");
  });

  it.each<[string, string]>([
    ["blank", "   "],
    ["too long", "x".repeat(MAX_ORDER_NOTE_LENGTH + 1)],
  ])("refuses a %s note", async (_label, body) => {
    const { repo, create } = notes();
    await expect(new AddOrderNote(repo, orders([order()]).repo).execute("o1", body, AUTHOR)).rejects.toThrow(
      ValidationError,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("accepts a note exactly at the limit", async () => {
    const { repo, create } = notes();
    await new AddOrderNote(repo, orders([order()]).repo).execute("o1", "x".repeat(MAX_ORDER_NOTE_LENGTH), AUTHOR);
    expect(create).toHaveBeenCalledOnce();
  });

  it("won't attach a note to an order that doesn't exist", async () => {
    const { repo, create } = notes();
    await expect(new AddOrderNote(repo, orders([]).repo).execute("missing", "hi", AUTHOR)).rejects.toThrow(
      NotFoundError,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("lists an order's notes", async () => {
    const { repo } = notes();
    expect((await new ListOrderNotes(repo).execute("o1"))[0].orderId).toBe("o1");
  });
});

describe("order queries", () => {
  it("hides someone else's order from a guest", async () => {
    const { repo } = orders([order({ id: "o1", userId: "g1" })]);
    expect(await new GetOwnOrder(repo).execute("o1", "g1")).not.toBeNull();
    expect(await new GetOwnOrder(repo).execute("o1", "g2")).toBeNull();
    expect(await new GetOwnOrder(repo).execute("missing", "g1")).toBeNull();
  });

  it("delegate the dashboard and guest reads", async () => {
    const mine = order();
    const theirs = order({ id: "o2", userId: "g2" });
    const { repo, listPage, listStatusEvents } = orders([mine, theirs]);
    const page = { page: 1, pageSize: 25 };

    expect((await new ListOrders(repo).execute({ status: "active" }, page)).total).toBe(2);
    expect(listPage).toHaveBeenCalledWith({ status: "active" }, page);
    expect(await new GetOrderStatusCounts(repo).execute()).toBe(COUNTS);
    expect(await new GetOrderById(repo).execute("o2")).toBe(theirs);
    expect(await new ListOwnOrders(repo).execute("g1")).toEqual([mine]);
    expect(await new ListOrderStatusEvents(repo).execute("o1")).toEqual([EVENT]);
    expect(listStatusEvents).toHaveBeenCalledWith("o1");
  });
});

describe("order entity helpers", () => {
  it("knows when any filter narrows the list", () => {
    expect(hasAdminOrderFilters({})).toBe(false);
    expect(hasAdminOrderFilters({ paymentStatus: "paid" })).toBe(true);
    expect(hasAdminOrderFilters({ query: "42" })).toBe(true);
  });

  it("strips line costs for guests", () => {
    const stripped = withoutCosts(order({ items: [item({ unitCost: 30 })] }));
    expect(stripped.items[0]).not.toHaveProperty("unitCost");
  });

  it("tracks the queue and which lines have gone out", () => {
    expect(isActiveOrder("ready")).toBe(true);
    expect(isActiveOrder("completed")).toBe(false);
    expect(canServeItems("pending")).toBe(false);
    expect(canServeItems("preparing")).toBe(true);
    const served = item({ id: "i2", servedAt: "2026-10-20T10:00:00Z", quantity: 1 });
    expect(itemServiceState(served)).toBe("served");
    expect(itemServiceState(item())).toBe("preparing");
    const twoLines = order({ items: [item(), served] });
    expect(servedLineCount(twoLines)).toEqual({ served: 1, total: 2 });
    expect(orderItemCount(twoLines)).toBe(3);
  });
});
