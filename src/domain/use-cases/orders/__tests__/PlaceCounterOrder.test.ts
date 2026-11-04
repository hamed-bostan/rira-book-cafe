import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../../../errors/ValidationError";
import { CheckoutPricing } from "../CheckoutPricing";
import { PlaceCounterOrder, QuoteCounterOrder, type CounterOrderInput } from "../PlaceCounterOrder";

import type { Category } from "../../../entities/Category";
import type { LoyaltySettings } from "../../../entities/Loyalty";
import type { Order, OrderStatus } from "../../../entities/Order";
import type { Product } from "../../../entities/Product";
import type { PromoCode } from "../../../entities/Promotion";
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
  categoryId: "coffee",
} as Product;

/** The counter's menu: the latte, in a category that's shown unless `hidden`. */
function menu(hidden = false) {
  return {
    products: { getByIds: vi.fn(async () => [LATTE]) },
    categories: { getAll: vi.fn(async () => [{ id: "coffee", isActive: !hidden } as Category]) },
  };
}
const productRepo = menu();

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

  it("can't ring up an item whose category staff hid, as guests can't order it", async () => {
    const { repo, place } = orderStore();

    await expect(new PlaceCounterOrder(repo, menu(true), noProfiles).execute(SALE, STAFF)).rejects.toMatchObject({
      field: "items",
      message: "One of the items is no longer on the menu.",
    });
    expect(place).not.toHaveBeenCalled();
  });
});

describe("PlaceCounterOrder — discounts and the service charge", () => {
  const NOW = new Date("2026-11-04T09:00:00Z");
  const CLUB: LoyaltySettings = {
    enabled: true,
    tomanPerPoint: 10_000,
    pointValue: 1_000,
    minRedeemPoints: 50,
    pointsExpiryMonths: 0,
  };
  const CODE: PromoCode = {
    id: "promo1",
    code: "AUTUMN",
    kind: "percent",
    value: 10,
    minSubtotal: 0,
    perGuestLimit: 1,
    isActive: true,
    productIds: [],
    categoryIds: [],
    firstOrderOnly: false,
    createdAt: "",
    updatedAt: "",
  };

  /** Pricing for a guest holding `balance` points, with `byGuest` uses of the code, at a service charge rate. */
  function pricing({ balance = 0, byGuest = 0, serviceChargeBps = 0 } = {}) {
    const usage = vi.fn(async () => ({ total: byGuest, byGuest }));
    const balanceOf = vi.fn(async () => balance);
    return {
      usage,
      balanceOf,
      pricing: new CheckoutPricing(
        {
          getByCode: vi.fn(async (code: string) => (code === "AUTUMN" ? CODE : null)),
          getById: vi.fn(async () => CODE),
          usage,
          hasCompletedOrder: vi.fn(async () => false),
        },
        { getSettings: vi.fn(async () => CLUB), balance: balanceOf },
        { getSettings: vi.fn(async () => ({ vatRateBps: 1000, serviceChargeBps })) },
      ),
    };
  }

  it("takes a promo code and the guest's points, counted against the guest's profile", async () => {
    const { repo, place } = orderStore();
    const { pricing: priced, usage, balanceOf } = pricing({ balance: 100 });
    const order = await new PlaceCounterOrder(repo, productRepo, noProfiles, priced).execute(
      { ...SALE, promoCode: "autumn", redeemPoints: true, paymentParts: [{ method: "cash", amount: 116_000 }] },
      STAFF,
      NOW,
    );

    // 240,000 − 24,000 (10%) − 100 points (100,000) = 116,000.
    expect(place.mock.calls[0][0]).toMatchObject({
      promoCodeId: "promo1",
      promoCode: "AUTUMN",
      promoDiscount: 24_000,
      pointsRedeemed: 100,
      pointsDiscount: 100_000,
      serviceCharge: 0,
      total: 116_000,
    });
    expect(order).toMatchObject({ paymentStatus: "paid", total: 116_000 });
    expect(usage).toHaveBeenCalledWith("promo1", "09123456789");
    expect(balanceOf).toHaveBeenCalledWith("09123456789");
  });

  it("refuses a code the guest already used up, before placing anything", async () => {
    const { repo, place } = orderStore();
    await expect(
      new PlaceCounterOrder(repo, productRepo, noProfiles, pricing({ byGuest: 1 }).pricing).execute(
        { ...SALE, promoCode: "AUTUMN" },
        STAFF,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "PROMO_USED_UP" });
    expect(place).not.toHaveBeenCalled();
  });

  it("charges a dine-in sale the service charge, and wants the payment to cover it", async () => {
    const { repo, place } = orderStore();
    const useCase = new PlaceCounterOrder(repo, productRepo, noProfiles, pricing({ serviceChargeBps: 1000 }).pricing);
    const dineIn = { ...SALE, serviceType: "dineIn" as const, tableLabel: "4" };

    await expect(
      useCase.execute({ ...dineIn, paymentParts: [{ method: "cash", amount: 240_000 }] }, STAFF, NOW),
    ).rejects.toThrow("paymentPartsTotal");
    await useCase.execute({ ...dineIn, paymentParts: [{ method: "cash", amount: 264_000 }] }, STAFF, NOW);
    expect(place.mock.calls[0][0]).toMatchObject({ serviceCharge: 24_000, serviceChargeBps: 1000, total: 264_000 });
  });

  it("quotes the sale by the guest's phone, and for no guest until a phone is in", async () => {
    const { pricing: priced, balanceOf } = pricing({ balance: 80, serviceChargeBps: 1000 });
    const quote = new QuoteCounterOrder(productRepo, priced);

    await expect(
      quote.execute({ ...SALE, serviceType: "dineIn", customerPhone: "0912 345 6789", redeemPoints: true }, NOW),
    ).resolves.toMatchObject({ pointsRedeemed: 80, pointsDiscount: 80_000, serviceCharge: 16_000, total: 176_000 });
    expect(balanceOf).toHaveBeenCalledWith("09123456789");

    await expect(quote.execute({ ...SALE, customerPhone: "0912" }, NOW)).resolves.toMatchObject({
      pointsBalance: 0,
      total: 240_000,
    });
    // A per-guest code needs the guest.
    await expect(quote.execute({ ...SALE, customerPhone: undefined, promoCode: "AUTUMN" }, NOW)).rejects.toMatchObject({
      code: "PROMO_NEEDS_GUEST",
    });
  });
});
