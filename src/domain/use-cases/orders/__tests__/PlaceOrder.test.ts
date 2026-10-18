import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../../../errors/ValidationError";
import { PlaceOrder } from "../PlaceOrder";

import type { Order } from "../../../entities/Order";
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
    imageUrl: "https://example.com/latte.png",
    categoryId: "c1",
    isFeatured: false,
    isPublished: true,
    taxExempt: true,
    ...overrides,
  };
}

function setup(products: Product[]) {
  const place = vi.fn(async (input: NewOrder): Promise<Order> => ({
    ...input,
    id: "o1",
    orderNumber: 1,
    status: "pending",
    paymentStatus: "unpaid",
    items: input.items.map((item, index) => ({ ...item, id: `i${index}` })),
    pointsEarned: 0,
    placedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
  const orderRepo = { place } as unknown as IOrderRepository;
  const productRepo = {
    getByIds: vi.fn(async (ids: readonly string[]) => products.filter((p) => ids.includes(p.id))),
  } as unknown as IProductRepository;
  return { useCase: new PlaceOrder(orderRepo, productRepo), place };
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

  it("refuses unknown items and bad quantities", async () => {
    const { useCase } = setup([product({})]);
    await expect(
      useCase.execute({ serviceType: "takeaway", items: [{ productId: "nope", quantity: 1 }] }, GUEST),
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ serviceType: "takeaway", items: [{ productId: "p1", quantity: 0 }] }, GUEST),
    ).rejects.toThrow(ValidationError);
  });
});
