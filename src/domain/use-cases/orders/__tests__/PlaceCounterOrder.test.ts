import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../../../errors/ValidationError";
import { PlaceCounterOrder, type CounterOrderInput } from "../PlaceCounterOrder";

import type { Order, OrderStatus } from "../../../entities/Order";
import type { Product } from "../../../entities/Product";
import type { IOrderRepository } from "../../../repositories/IOrderRepository";

const STAFF = { id: "staff", name: "Sara" };

const LATTE = {
  id: "latte",
  kind: "drink",
  name: "Latte",
  imageUrl: "/latte.jpg",
  price: 120_000,
  isPublished: true,
} as Product;

const productRepo = { getByIds: vi.fn(async () => [LATTE]) };

const SALE: CounterOrderInput = {
  items: [{ productId: "latte", quantity: 2 }],
  serviceType: "takeaway",
  customerName: "Walk-in guest",
};

/** An order repository that applies each write, as the real one does. */
function orderStore() {
  let current: Order | null = null;
  const place = vi.fn<IOrderRepository["place"]>(async (input) => {
    current = {
      ...input,
      id: "o1",
      orderNumber: 7,
      status: "pending",
      paymentStatus: "unpaid",
      pointsEarned: 0,
      refundedTotal: 0,
      placedAt: "",
      updatedAt: "",
      items: input.items.map((item, index) => ({ ...item, id: `i${index}` })),
    };
    return current;
  });
  const setPaymentStatus = vi.fn<IOrderRepository["setPaymentStatus"]>(async (_id, change) => {
    current = { ...(current as Order), paymentStatus: change.to, paymentParts: change.parts?.slice() };
    return current;
  });
  const transition = vi.fn<IOrderRepository["transition"]>(async (_id, _from, to: OrderStatus) => {
    current = { ...(current as Order), status: to };
    return current;
  });
  const repo = {
    place,
    setPaymentStatus,
    transition,
    getById: vi.fn(async () => current),
  } as unknown as IOrderRepository;
  return { repo, place, setPaymentStatus, transition };
}

describe("PlaceCounterOrder", () => {
  it("prices from the menu, belongs to no account, and logs who rang it up", async () => {
    const { repo, place } = orderStore();
    const order = await new PlaceCounterOrder(repo, productRepo).execute(SALE, STAFF);

    expect(order).toMatchObject({ status: "pending", paymentStatus: "unpaid", total: 240_000 });
    expect(order.userId).toBeUndefined();
    expect(place.mock.calls[0][0]).toMatchObject({
      customerName: "Walk-in guest",
      customerPhone: "",
      promoDiscount: 0,
    });
    expect(place.mock.calls[0][2]?.(order)).toMatchObject({ action: "order.counterSale", actorName: "Sara" });
  });

  it("takes payment and hands over in one go", async () => {
    const { repo, setPaymentStatus, transition } = orderStore();
    const order = await new PlaceCounterOrder(repo, productRepo).execute(
      {
        ...SALE,
        paymentParts: [
          { method: "cash", amount: 40_000 },
          { method: "card", amount: 200_000 },
        ],
        complete: true,
      },
      STAFF,
    );

    expect(order).toMatchObject({ status: "completed", paymentStatus: "paid" });
    // Largest first: it becomes the order's method.
    expect(setPaymentStatus.mock.calls[0][1].parts?.map((part) => part.method)).toEqual(["card", "cash"]);
    expect(transition.mock.calls.map((call) => call[2])).toEqual(["preparing", "completed"]);
  });

  it("refuses a split that doesn't add up, before placing anything", async () => {
    const { repo, place } = orderStore();

    await expect(
      new PlaceCounterOrder(repo, productRepo).execute(
        { ...SALE, paymentParts: [{ method: "cash", amount: 100_000 }] },
        STAFF,
      ),
    ).rejects.toThrow("paymentPartsTotal");
    expect(place).not.toHaveBeenCalled();
  });

  it("needs a name, and a table for dine-in", async () => {
    const { repo } = orderStore();
    const useCase = new PlaceCounterOrder(repo, productRepo);

    await expect(useCase.execute({ ...SALE, customerName: "  " }, STAFF)).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ ...SALE, serviceType: "dineIn" }, STAFF)).rejects.toThrow(ValidationError);
  });
});
