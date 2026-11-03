import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../../../errors/ValidationError";
import { PlaceCounterOrder, type CounterOrderInput } from "../PlaceCounterOrder";

import type { Order, OrderStatus } from "../../../entities/Order";
import type { Product } from "../../../entities/Product";
import type { User } from "../../../entities/User";
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

/** Nobody has a profile yet. */
const noProfiles = { getById: vi.fn(async (): Promise<User | null> => null) };

const SALE: CounterOrderInput = {
  items: [{ productId: "latte", quantity: 2 }],
  serviceType: "takeaway",
  customerPhone: "+98 912 345 6789",
  customerName: "Sara Ahmadi",
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
  it("prices from the menu, makes a new guest's profile with the sale, and logs who rang it up", async () => {
    const { repo, place } = orderStore();
    const order = await new PlaceCounterOrder(repo, productRepo, noProfiles).execute(SALE, STAFF);

    expect(order).toMatchObject({ status: "pending", paymentStatus: "unpaid", total: 240_000 });
    expect(order.userId).toBe("09123456789");
    expect(place.mock.calls[0][0]).toMatchObject({
      userId: "09123456789",
      newGuest: { id: "09123456789", phone: "+98 912 345 6789", name: "Sara Ahmadi", createdBy: STAFF },
      customerName: "Sara Ahmadi",
      customerPhone: "+98 912 345 6789",
      promoDiscount: 0,
    });
    expect(place.mock.calls[0][2]?.(order)).toMatchObject({ action: "order.counterSale", actorName: "Sara" });
  });

  it("rings a guest with a profile up under its own name, making nothing", async () => {
    const { repo, place } = orderStore();
    const profiles = {
      getById: vi.fn(async (): Promise<User | null> => ({
        id: "09123456789",
        phone: "09123456789",
        name: "Sara A.",
        email: null,
        avatarUrl: null,
        role: "customer",
      })),
    };
    await new PlaceCounterOrder(repo, productRepo, profiles).execute(
      { ...SALE, customerPhone: "۰۹۱۲ ۳۴۵ ۶۷۸۹", customerName: undefined },
      STAFF,
    );

    expect(profiles.getById).toHaveBeenCalledWith("09123456789");
    expect(place.mock.calls[0][0]).toMatchObject({ userId: "09123456789", customerName: "Sara A." });
    expect(place.mock.calls[0][0].newGuest).toBeUndefined();
  });

  it("needs the guest's phone on every sale, and a new guest's name, before placing anything", async () => {
    const { repo, place } = orderStore();
    const useCase = new PlaceCounterOrder(repo, productRepo, noProfiles);

    await expect(useCase.execute({ ...SALE, customerPhone: "" }, STAFF)).rejects.toMatchObject({
      field: "customerPhone",
      message: "phoneInvalid",
    });
    await expect(useCase.execute({ ...SALE, customerName: " " }, STAFF)).rejects.toMatchObject({
      field: "customerName",
      message: "guestNameNeeded",
    });
    expect(place).not.toHaveBeenCalled();
  });

  it("takes payment and hands over in one go", async () => {
    const { repo, setPaymentStatus, transition } = orderStore();
    const order = await new PlaceCounterOrder(repo, productRepo, noProfiles).execute(
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
      new PlaceCounterOrder(repo, productRepo, noProfiles).execute(
        { ...SALE, paymentParts: [{ method: "cash", amount: 100_000 }] },
        STAFF,
      ),
    ).rejects.toThrow("paymentPartsTotal");
    expect(place).not.toHaveBeenCalled();
  });

  it("needs a table for dine-in", async () => {
    const { repo } = orderStore();
    const useCase = new PlaceCounterOrder(repo, productRepo, noProfiles);

    await expect(useCase.execute({ ...SALE, serviceType: "dineIn" }, STAFF)).rejects.toThrow(ValidationError);
  });
});
