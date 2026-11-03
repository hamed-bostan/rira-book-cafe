import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { ChangeOrder, orderChangeDiff } from "../ChangeOrder";
import { CheckoutPricing } from "../CheckoutPricing";

import type { Order, OrderItem } from "../../../entities/Order";
import type { Product } from "../../../entities/Product";
import type { PromoCode, PromoUsage } from "../../../entities/Promotion";
import type { IOrderRepository, OrderChange } from "../../../repositories/IOrderRepository";
import type { IProductRepository } from "../../../repositories/IProductRepository";

const STAFF = { id: "s1", name: "Bita" };
const NOW = new Date("2026-11-03T10:00:00Z");
const UPDATED = "2026-11-03T09:00:00.000Z";

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "i1",
    productId: "p-latte",
    kind: "drink",
    name: "Latte",
    imageUrl: "/latte.png",
    unitPrice: 100_000,
    quantity: 2,
    ...overrides,
  };
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: 42,
    userId: "09120000004",
    customerName: "Sara",
    customerPhone: "09120000004",
    status: "pending",
    serviceType: "dineIn",
    tableLabel: "4",
    paymentStatus: "unpaid",
    refundedTotal: 0,
    items: [
      item(),
      item({ id: "i2", productId: "p-cake", kind: "food", name: "Cake", unitPrice: 80_000, quantity: 1 }),
    ],
    subtotal: 280_000,
    promoDiscount: 0,
    pointsRedeemed: 0,
    pointsDiscount: 0,
    pointsEarned: 0,
    total: 280_000,
    placedAt: "2026-11-03T08:00:00.000Z",
    updatedAt: UPDATED,
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-tea",
    kind: "drink",
    name: "Tea",
    price: 50_000,
    costPrice: 10_000,
    rating: 0,
    ratingCount: 0,
    stockQuantity: 10,
    madeToOrder: true,
    imageUrl: "/tea.png",
    categoryId: "c1",
    isFeatured: false,
    isPublished: true,
    taxExempt: false,
    ...overrides,
  };
}

type Setup = {
  current?: Order | null;
  products?: Product[];
  pricing?: CheckoutPricing;
};

/** The use-case over fakes; `change` answers with the order as the change would leave it. */
function setup({ current = order(), products = [product()], pricing }: Setup = {}) {
  const change = vi.fn<IOrderRepository["change"]>(async (input: OrderChange): Promise<Order> => {
    const base = current as Order;
    const items = base.items.flatMap((line) => {
      const lowered = input.lower.find((candidate) => candidate.itemId === line.id);
      if (!lowered) return [line];
      return lowered.to > 0 ? [{ ...line, quantity: lowered.to }] : [];
    });
    return {
      ...base,
      ...input.amounts,
      serviceType: input.serviceType,
      tableLabel: input.tableLabel,
      items: [...items, ...input.add.map((line, index) => ({ ...line, id: `n${index}`, addedAt: NOW.toISOString() }))],
      changedAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    };
  });
  const repo = { getById: vi.fn(async () => current), change } as unknown as IOrderRepository;
  const productRepo = {
    getByIds: vi.fn(async (ids: readonly string[]) => products.filter((candidate) => ids.includes(candidate.id))),
  } as unknown as IProductRepository;
  const notify = vi.fn(async () => undefined);
  const useCase = new ChangeOrder(repo, productRepo, pricing ?? new CheckoutPricing(), { notify });
  return { useCase, change, notify };
}

describe("ChangeOrder", () => {
  it("adds a round priced from the menu, re-prices the order, logs it and tells the guest", async () => {
    const { useCase, change, notify } = setup();

    const saved = await useCase.execute(
      "o1",
      { add: [{ productId: "p-tea", quantity: 2, note: " no sugar " }], version: UPDATED },
      STAFF,
      NOW,
    );

    const [input, actor, audit] = change.mock.calls[0];
    expect(actor).toEqual(STAFF);
    expect(input).toMatchObject({
      orderId: "o1",
      expected: { updatedAt: UPDATED, status: "pending", paymentStatus: "unpaid" },
      lower: [],
      serviceType: "dineIn",
      tableLabel: "4",
      amounts: { subtotal: 380_000, promoDiscount: 0, pointsDiscount: 0, total: 380_000 },
    });
    expect(input.add).toEqual([
      expect.objectContaining({
        productId: "p-tea",
        unitPrice: 50_000,
        unitCost: 10_000,
        quantity: 2,
        note: "no sugar",
      }),
    ]);
    expect(audit?.(saved)).toMatchObject({
      action: "order.changed",
      entityType: "order",
      entityId: "o1",
      entityLabel: "#42",
      changes: [
        { field: "linesAdded", before: null, after: "2× Tea (no sugar)" },
        { field: "total", before: "280000", after: "380000" },
      ],
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "09120000004", kind: "orderChanged", link: "/orders/o1" }),
    );
  });

  it("lowers one line and takes another off, re-pricing from what's left", async () => {
    const { useCase, change } = setup();

    await useCase.execute(
      "o1",
      {
        lines: [
          { itemId: "i1", quantity: 1 },
          { itemId: "i2", quantity: 0 },
        ],
      },
      STAFF,
      NOW,
    );

    expect(change.mock.calls[0][0]).toMatchObject({
      lower: [
        { itemId: "i1", from: 2, to: 1 },
        { itemId: "i2", from: 1, to: 0 },
      ],
      add: [],
      amounts: { subtotal: 100_000, total: 100_000 },
    });
  });

  it("won't lower or take off a line already served", async () => {
    const served = order({
      status: "preparing",
      items: [item({ servedAt: "2026-11-03T08:30:00.000Z" }), item({ id: "i2", name: "Cake" })],
    });
    const { useCase, change } = setup({ current: served });

    await expect(useCase.execute("o1", { lines: [{ itemId: "i1", quantity: 1 }] }, STAFF, NOW)).rejects.toMatchObject({
      code: "ITEM_SERVED",
    });
    await expect(useCase.execute("o1", { lines: [{ itemId: "i1", quantity: 0 }] }, STAFF, NOW)).rejects.toMatchObject({
      code: "ITEM_SERVED",
    });
    // The line that's still being made can go.
    await useCase.execute("o1", { lines: [{ itemId: "i2", quantity: 0 }] }, STAFF, NOW);
    expect(change).toHaveBeenCalledOnce();
  });

  it("won't change the lines of a paid order, but still moves it to another table", async () => {
    const { useCase, change } = setup({ current: order({ paymentStatus: "paid" }) });

    await expect(
      useCase.execute("o1", { add: [{ productId: "p-tea", quantity: 1 }] }, STAFF, NOW),
    ).rejects.toMatchObject({ code: "ORDER_LINES_LOCKED" });
    await expect(useCase.execute("o1", { lines: [{ itemId: "i1", quantity: 1 }] }, STAFF, NOW)).rejects.toMatchObject({
      code: "ORDER_LINES_LOCKED",
    });

    await useCase.execute("o1", { tableLabel: " 9 " }, STAFF, NOW);
    expect(change.mock.calls[0][0]).toMatchObject({ tableLabel: "9", lower: [], add: [] });
    expect(change.mock.calls[0][0].amounts).toBeUndefined();
  });

  it("changes nothing once the order is served or cancelled", async () => {
    for (const status of ["completed", "cancelled"] as const) {
      const { useCase, change } = setup({ current: order({ status }) });
      await expect(useCase.execute("o1", { serviceType: "takeaway" }, STAFF, NOW)).rejects.toMatchObject({
        code: "ORDER_CLOSED",
      });
      await expect(
        useCase.execute("o1", { add: [{ productId: "p-tea", quantity: 1 }] }, STAFF, NOW),
      ).rejects.toMatchObject({ code: "ORDER_CLOSED" });
      expect(change).not.toHaveBeenCalled();
    }
  });

  it("switches to takeaway, dropping the table, and to dine-in only with one", async () => {
    const { useCase, change } = setup();
    await useCase.execute("o1", { serviceType: "takeaway" }, STAFF, NOW);
    expect(change.mock.calls[0][0]).toMatchObject({ serviceType: "takeaway", tableLabel: undefined });

    const takeaway = setup({ current: order({ serviceType: "takeaway", tableLabel: undefined }) });
    await expect(takeaway.useCase.execute("o1", { serviceType: "dineIn" }, STAFF, NOW)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("refuses to leave the order empty — that's a cancellation", async () => {
    const { useCase, change } = setup();

    await expect(
      useCase.execute(
        "o1",
        {
          lines: [
            { itemId: "i1", quantity: 0 },
            { itemId: "i2", quantity: 0 },
          ],
        },
        STAFF,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "ORDER_EMPTY" });
    expect(change).not.toHaveBeenCalled();
  });

  it("only lowers: more of an item is a new round", async () => {
    const { useCase } = setup();

    await expect(useCase.execute("o1", { lines: [{ itemId: "i1", quantity: 3 }] }, STAFF, NOW)).rejects.toMatchObject({
      field: "lines",
      message: "lineRaise",
    });
    await expect(
      useCase.execute("o1", { lines: [{ itemId: "nope", quantity: 0 }] }, STAFF, NOW),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a change made from a stale copy of the order", async () => {
    const { useCase, change } = setup();

    await expect(
      useCase.execute("o1", { tableLabel: "9", version: "2026-11-03T08:59:00.000Z" }, STAFF, NOW),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect(change).not.toHaveBeenCalled();
  });

  it("is a no-op when nothing would change", async () => {
    const { useCase, change, notify } = setup();

    const result = await useCase.execute(
      "o1",
      { serviceType: "dineIn", tableLabel: "4", lines: [{ itemId: "i1", quantity: 2 }] },
      STAFF,
      NOW,
    );

    expect(result.id).toBe("o1");
    expect(change).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuses an item that's off the menu", async () => {
    const { useCase } = setup({ products: [product({ isPublished: false })] });

    await expect(
      useCase.execute("o1", { add: [{ productId: "p-tea", quantity: 1 }] }, STAFF, NOW),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses a change its promo code no longer prices", async () => {
    const promo: PromoCode = {
      id: "promo1",
      code: "BIG",
      kind: "fixed",
      value: 50_000,
      minSubtotal: 250_000,
      isActive: true,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    };
    const usage: PromoUsage = { total: 1, byGuest: 1 };
    const pricing = new CheckoutPricing(
      { getByCode: vi.fn(async () => promo), usage: vi.fn(async () => usage) },
      undefined,
    );
    const withPromo = order({ promoCode: "BIG", promoCodeId: "promo1", promoDiscount: 50_000, total: 230_000 });
    const { useCase, change } = setup({ current: withPromo, pricing });

    // 280,000 → 180,000: under the code's 250,000 minimum.
    await expect(useCase.execute("o1", { lines: [{ itemId: "i1", quantity: 1 }] }, STAFF, NOW)).rejects.toMatchObject({
      code: "PROMO_NO_LONGER_APPLIES",
    });
    expect(change).not.toHaveBeenCalled();
  });

  it("refuses a change that leaves the points spent worth more than the order", async () => {
    const withPoints = order({ pointsRedeemed: 200, pointsDiscount: 200_000, total: 80_000 });
    const { useCase } = setup({ current: withPoints });

    await expect(useCase.execute("o1", { lines: [{ itemId: "i1", quantity: 1 }] }, STAFF, NOW)).rejects.toMatchObject({
      code: "POINTS_EXCEED_TOTAL",
    });
  });

  it("reads a missing order as not found", async () => {
    const { useCase } = setup({ current: null });

    await expect(useCase.execute("o1", { tableLabel: "9" }, STAFF, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("tells a counter sale's guest on its profile, and nobody on an old sale without one", async () => {
    const counter = setup({ current: order({ userId: "09123456789", customerPhone: "0912 345 6789" }) });
    await counter.useCase.execute("o1", { tableLabel: "9" }, STAFF, NOW);
    expect(counter.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "09123456789" }));

    const anonymous = setup({ current: order({ userId: undefined, customerPhone: "" }) });
    await anonymous.useCase.execute("o1", { tableLabel: "9" }, STAFF, NOW);
    expect(anonymous.notify).not.toHaveBeenCalled();
  });
});

describe("orderChangeDiff", () => {
  it("says which lines were added, lowered and taken off, and what else moved", () => {
    const before = order();
    const after = order({
      serviceType: "takeaway",
      tableLabel: undefined,
      items: [item({ quantity: 1 }), item({ id: "n0", name: "Tea", quantity: 3, note: "hot" })],
      total: 250_000,
    });

    expect(orderChangeDiff(before, after)).toEqual([
      { field: "linesAdded", before: null, after: "3× Tea (hot)" },
      { field: "quantities", before: "2× Latte", after: "1× Latte" },
      { field: "linesRemoved", before: "1× Cake", after: null },
      { field: "serviceType", before: "dineIn", after: "takeaway" },
      { field: "tableLabel", before: "4", after: null },
      { field: "total", before: "280000", after: "250000" },
    ]);
  });

  it("is only the table for a move", () => {
    expect(orderChangeDiff(order(), order({ tableLabel: "9" }))).toEqual([
      { field: "tableLabel", before: "4", after: "9" },
    ]);
  });
});

// The conflict error is the use-case's way to refuse; it's never a validation one.
describe("ChangeOrder refusals", () => {
  it("are conflicts, so the API answers 409", async () => {
    const { useCase } = setup({ current: order({ status: "completed" }) });
    await expect(useCase.execute("o1", { tableLabel: "9" }, STAFF, NOW)).rejects.toBeInstanceOf(ConflictError);
  });
});
