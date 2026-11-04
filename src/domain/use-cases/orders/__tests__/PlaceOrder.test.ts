import { describe, expect, it, vi } from "vitest";

import { MAX_ORDER_AMOUNT, type Order } from "../../../entities/Order";
import { ValidationError } from "../../../errors/ValidationError";
import { PlaceOrder } from "../PlaceOrder";

import type { Category } from "../../../entities/Category";
import type { Product } from "../../../entities/Product";
import type { IOrderRepository, NewOrder } from "../../../repositories/IOrderRepository";
import type { IProductRepository } from "../../../repositories/IProductRepository";

function product(overrides: Partial<Product>): Product {
  return {
    id: "p1",
    kind: "drink",
    name: "Latte",
    price: 150000,
    rating: 0,
    ratingCount: 0,
    stockQuantity: 10,
    madeToOrder: false,
    imageUrl: "https://example.com/latte.png",
    categoryId: "c1",
    isFeatured: false,
    isPublished: true,
    taxExempt: true,
    ...overrides,
  };
}

/** The menu's categories: `c1` shown, `c-hidden` hidden by staff. */
const CATEGORIES = [{ id: "c1", isActive: true } as Category, { id: "c-hidden", isActive: false } as Category];

function setup(products: Product[]) {
  const place = vi.fn(async (input: NewOrder): Promise<Order> => ({
    ...input,
    id: "o1",
    orderNumber: 1,
    status: "pending",
    paymentStatus: "unpaid",
    items: input.items.map((item, index) => ({ ...item, id: `i${index}` })),
    pointsEarned: 0,
    refundedTotal: 0,
    placedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
  const orderRepo = { place } as unknown as IOrderRepository;
  const productRepo = {
    getByIds: vi.fn(async (ids: readonly string[]) => products.filter((p) => ids.includes(p.id))),
  } as unknown as IProductRepository;
  const categories = { getAll: vi.fn(async () => CATEGORIES) };
  return { useCase: new PlaceOrder(orderRepo, { products: productRepo, categories }), place };
}

const GUEST = { id: "09120000000", name: "Sara", phone: "09120000000" };

describe("PlaceOrder", () => {
  it("prices lines from the menu, not the request", async () => {
    const { useCase, place } = setup([
      product({ id: "p1", price: 150000 }),
      product({ id: "p2", name: "Cake", kind: "food", price: 90000 }),
    ]);

    const order = await useCase.execute(
      {
        serviceType: "takeaway",
        items: [
          { productId: "p1", quantity: 2 },
          { productId: "p2", quantity: 1, note: " warm " },
        ],
      },
      GUEST,
    );

    expect(order.total).toBe(390000);
    expect(order.items[1]).toMatchObject({ name: "Cake", unitPrice: 90000, note: "warm" });
    expect(place.mock.calls[0][0].customerName).toBe("Sara");
  });

  it("requires a table for dine-in and drops it for takeaway", async () => {
    const { useCase } = setup([product({})]);
    await expect(
      useCase.execute({ serviceType: "dineIn", items: [{ productId: "p1", quantity: 1 }] }, GUEST),
    ).rejects.toThrow(ValidationError);
    const takeaway = await useCase.execute(
      { serviceType: "takeaway", tableLabel: "4", items: [{ productId: "p1", quantity: 1 }] },
      GUEST,
    );
    expect(takeaway.tableLabel).toBeUndefined();
  });

  it("refuses unpublished items and reading-only books", async () => {
    const { useCase } = setup([
      product({ id: "hidden", isPublished: false }),
      product({ id: "book", kind: "book", book: { author: "Hedayat", availability: "reading" } }),
    ]);
    await expect(
      useCase.execute({ serviceType: "takeaway", items: [{ productId: "hidden", quantity: 1 }] }, GUEST),
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ serviceType: "takeaway", items: [{ productId: "book", quantity: 1 }] }, GUEST),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses an item in a hidden category, or one whose category is gone, as off the menu", async () => {
    const { useCase, place } = setup([
      product({ id: "seasonal", categoryId: "c-hidden" }),
      product({ id: "stray", categoryId: "c-gone" }),
    ]);
    for (const productId of ["seasonal", "stray"]) {
      await expect(
        useCase.execute({ serviceType: "takeaway", items: [{ productId, quantity: 1 }] }, GUEST),
      ).rejects.toMatchObject({ field: "items", message: "One of the items is no longer on the menu." });
    }
    expect(place).not.toHaveBeenCalled();
  });

  it("refuses unknown items and bad quantities", async () => {
    const { useCase } = setup([product({})]);
    await expect(
      useCase.execute({ serviceType: "takeaway", items: [{ productId: "nope", quantity: 1 }] }, GUEST),
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ serviceType: "takeaway", items: [{ productId: "p1", quantity: 0 }] }, GUEST),
    ).rejects.toThrow(ValidationError);
  });

  it("takes an order up to the most one can come to, and refuses one past it", async () => {
    const half = MAX_ORDER_AMOUNT / 2;
    const { useCase, place } = setup([product({ price: half })]);

    const order = await useCase.execute({ serviceType: "takeaway", items: [{ productId: "p1", quantity: 2 }] }, GUEST);
    expect(order.total).toBe(MAX_ORDER_AMOUNT);

    await expect(
      useCase.execute({ serviceType: "takeaway", items: [{ productId: "p1", quantity: 3 }] }, GUEST),
    ).rejects.toMatchObject({ name: "ValidationError", field: "items" });
    expect(place).toHaveBeenCalledTimes(1);
  });
});

describe("PlaceOrder with options", () => {
  const latte = product({
    id: "p1",
    price: 100000,
    optionGroups: [
      {
        id: "size",
        name: "Size",
        nameFa: "اندازه",
        required: true,
        selection: "single",
        minChoices: 1,
        maxChoices: 1,
        choices: [
          { id: "s", name: "Small", priceDelta: 0, isAvailable: true, isDefault: false },
          { id: "m", name: "Medium", nameFa: "متوسط", priceDelta: 10000, isAvailable: true, isDefault: true },
          { id: "l", name: "Large", priceDelta: 20000, isAvailable: false, isDefault: false },
        ],
      },
      {
        id: "extras",
        name: "Extras",
        required: false,
        selection: "multiple",
        minChoices: 0,
        maxChoices: 1,
        choices: [
          { id: "shot", name: "Extra shot", priceDelta: 15000, isAvailable: true, isDefault: false },
          { id: "oat", name: "Oat milk", priceDelta: 12000, isAvailable: true, isDefault: false },
        ],
      },
    ],
  });

  it("prices each line at the item's price plus what its choices add now, and snapshots them", async () => {
    const { useCase } = setup([latte]);
    const order = await useCase.execute(
      {
        serviceType: "takeaway",
        items: [
          { productId: "p1", quantity: 2, choiceIds: ["shot", "s"] },
          { productId: "p1", quantity: 1, choiceIds: ["m"] },
        ],
      },
      GUEST,
    );

    expect(order.items[0]).toMatchObject({ unitPrice: 115000, quantity: 2 });
    expect(order.items[0].options).toEqual([
      { groupId: "size", group: "Size", groupFa: "اندازه", choiceId: "s", choice: "Small", priceDelta: 0 },
      { groupId: "extras", group: "Extras", choiceId: "shot", choice: "Extra shot", priceDelta: 15000 },
    ]);
    expect(order.items[1]).toMatchObject({ unitPrice: 110000 });
    expect(order.subtotal).toBe(340000);
    expect(order.total).toBe(340000);
  });

  it("gives a required group its default when the request left it out", async () => {
    const { useCase } = setup([latte]);
    const order = await useCase.execute({ serviceType: "takeaway", items: [{ productId: "p1", quantity: 1 }] }, GUEST);
    expect(order.items[0]).toMatchObject({ unitPrice: 110000 });
    expect(order.items[0].options?.map((option) => option.choiceId)).toEqual(["m"]);
  });

  it("refuses unknown and switched-off choices, and selections its groups don't allow", async () => {
    const { useCase, place } = setup([latte, product({ id: "p2", name: "Cake", kind: "food" })]);
    const cases: [string[], string, string?][] = [
      [["m", "gone"], "optionUnknown"],
      [["l"], "optionUnavailable"],
      [["s", "m"], "optionTooMany"],
      [["m", "shot", "oat"], "optionTooMany"],
      [["s"], "optionUnknown", "p2"],
    ];
    for (const [choiceIds, message, productId = "p1"] of cases) {
      await expect(
        useCase.execute({ serviceType: "takeaway", items: [{ productId, quantity: 1, choiceIds }] }, GUEST),
      ).rejects.toMatchObject({ name: "ValidationError", field: "items", message });
    }
    const noDefault = {
      ...latte,
      optionGroups: latte.optionGroups?.map((group) => ({
        ...group,
        choices: group.choices.map((choice) => ({ ...choice, isDefault: false })),
      })),
    };
    const strict = setup([noDefault]);
    await expect(
      strict.useCase.execute({ serviceType: "takeaway", items: [{ productId: "p1", quantity: 1 }] }, GUEST),
    ).rejects.toMatchObject({ message: "optionRequired" });
    expect(place).not.toHaveBeenCalled();
  });

  it("leaves items without options exactly as they were", async () => {
    const { useCase } = setup([product({ id: "p2", price: 90000 })]);
    const order = await useCase.execute({ serviceType: "takeaway", items: [{ productId: "p2", quantity: 1 }] }, GUEST);
    expect(order.items[0].unitPrice).toBe(90000);
    expect(order.items[0]).not.toHaveProperty("options");
  });
});
