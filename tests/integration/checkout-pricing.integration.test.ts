import { describe, expect, it } from "vitest";

import { PUT as saveAccountingSettings } from "@/app/api/admin/accounting/settings/route";
import { POST as adjustPoints } from "@/app/api/admin/loyalty/adjustments/route";
import { PUT as saveLoyaltySettings } from "@/app/api/admin/loyalty/settings/route";
import { PATCH as setPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { POST as refundOrder } from "@/app/api/admin/orders/[id]/refunds/route";
import { PATCH as changeOrder } from "@/app/api/admin/orders/[id]/route";
import { PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as writeOffOrder } from "@/app/api/admin/orders/[id]/write-off/route";
import { POST as quoteCounterSale } from "@/app/api/admin/orders/quote/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { POST as createPromoCode } from "@/app/api/admin/promo-codes/route";
import { GET as getLoyalty } from "@/app/api/loyalty/route";
import { POST as quoteOrder } from "@/app/api/orders/quote/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import type { OrderQuote } from "@/src/domain/entities/Checkout";
import type { AccountingSettings } from "@/src/domain/entities/Ledger";
import type { GuestLoyaltyOverview, LoyaltySettings } from "@/src/domain/entities/Loyalty";
import type { Order } from "@/src/domain/entities/Order";
import type { PromoCode } from "@/src/domain/entities/Promotion";
import { ExpireLoyaltyPoints } from "@/src/domain/use-cases/jobs/ExpireLoyaltyPoints";
import { customerNotifier, loyaltyRepository } from "@/src/infrastructure/container";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const GUEST = TEST_USERS.customer;
const BOOK = "seed-book-uncle-napoleon";

/** Net credits − debits on an account (revenue reads positive). */
async function creditBalance(accountCode: string): Promise<number> {
  const sum = await prisma.journalLine.aggregate({ where: { accountCode }, _sum: { debit: true, credit: true } });
  return Number(sum._sum.credit ?? 0) - Number(sum._sum.debit ?? 0);
}

async function pointsOf(userId: string): Promise<number> {
  const sum = await prisma.loyaltyTransaction.aggregate({ where: { userId }, _sum: { delta: true } });
  return sum._sum.delta ?? 0;
}

async function givePoints(userId: string, delta: number, createdAt?: Date): Promise<void> {
  await prisma.loyaltyTransaction.create({ data: { userId, delta, reason: "earn", createdAt } });
}

async function setStatus(orderId: string, status: string): Promise<void> {
  signInAs("staff");
  const response = await changeStatus(
    jsonRequest("PATCH", `/api/admin/orders/${orderId}/status`, { status }),
    routeParams({ id: orderId }),
  );
  expect(response.status).toBe(200);
}

async function payCash(orderId: string): Promise<void> {
  signInAs("staff");
  const response = await setPayment(
    jsonRequest("PATCH", `/api/admin/orders/${orderId}/payment`, { paymentStatus: "paid", paymentMethod: "cash" }),
    routeParams({ id: orderId }),
  );
  expect(response.status).toBe(200);
}

async function guestQuote(body: Record<string, unknown>): Promise<Response> {
  signInAs("customer");
  return quoteOrder(jsonRequest("POST", "/api/orders/quote", body));
}

describe("promo codes and points on a counter sale", () => {
  const TWO_CAPPUCCINOS = [{ productId: "seed-cappuccino", quantity: 2 }];

  async function counterQuote(body: Record<string, unknown>): Promise<Response> {
    signInAs("staff");
    return quoteCounterSale(
      jsonRequest("POST", "/api/admin/orders/quote", { items: TWO_CAPPUCCINOS, serviceType: "takeaway", ...body }),
    );
  }

  async function ringUp(body: Record<string, unknown>): Promise<Response> {
    signInAs("staff");
    return ringUpSale(
      jsonRequest("POST", "/api/admin/orders", { items: TWO_CAPPUCCINOS, serviceType: "takeaway", ...body }),
    );
  }

  it("quotes and rings up a sale with a code and the guest's points, priced and claimed as at checkout", async () => {
    await prisma.promoCode.create({ data: { code: "COUNTER10", kind: "percent", value: 10, perGuestLimit: 1 } });
    await givePoints(GUEST.id, 200);

    const quoted = await counterQuote({ customerPhone: GUEST.phone, promoCode: "counter10", redeemPoints: true });
    expect(quoted.status).toBe(200);
    // 290,000 − 29,000 (10%) − 200 points (200,000) = 61,000.
    expect(await readJson<OrderQuote>(quoted)).toMatchObject({
      subtotal: 290_000,
      promoCode: "COUNTER10",
      promoDiscount: 29_000,
      pointsRedeemed: 200,
      pointsDiscount: 200_000,
      serviceCharge: 0,
      total: 61_000,
    });

    const response = await ringUp({
      customerPhone: GUEST.phone,
      promoCode: "COUNTER10",
      redeemPoints: true,
      paymentParts: [{ method: "cash", amount: 61_000 }],
      complete: true,
    });
    expect(response.status).toBe(201);
    const order = await readJson<Order>(response);
    expect(order).toMatchObject({
      userId: GUEST.id,
      promoCode: "COUNTER10",
      promoDiscount: 29_000,
      pointsRedeemed: 200,
      total: 61_000,
      status: "completed",
      paymentStatus: "paid",
    });
    // The 200 spent, then 6 earned on the 61,000 paid.
    expect(await pointsOf(GUEST.id)).toBe(6);

    // The code's per-guest limit counts against the guest's profile, at the counter too.
    const again = await ringUp({ customerPhone: GUEST.phone, promoCode: "COUNTER10" });
    expect(again.status).toBe(409);
    expect((await readError(again)).code).toBe("PROMO_USED_UP");
  });

  it("refuses a payment that doesn't cover the discounted total, and points a guest doesn't have", async () => {
    await givePoints(GUEST.id, 60);
    const short = await ringUp({
      customerPhone: GUEST.phone,
      redeemPoints: true,
      paymentParts: [{ method: "cash", amount: 290_000 }],
    });
    expect(short.status).toBe(400);

    const none = await counterQuote({ customerPhone: "0912 777 0001", redeemPoints: true });
    expect(none.status).toBe(409);
    expect((await readError(none)).code).toBe("NOT_ENOUGH_POINTS");
    expect(await prisma.order.count()).toBe(0);
  });

  it("is staff's: a guest can't quote the counter", async () => {
    signInAs("customer");
    const response = await quoteCounterSale(
      jsonRequest("POST", "/api/admin/orders/quote", { items: TWO_CAPPUCCINOS, serviceType: "takeaway" }),
    );
    expect(response.status).toBe(401);
  });
});

describe("promo codes scoped to categories, items and first orders", () => {
  async function bookCategory(): Promise<string> {
    const book = await prisma.product.findUniqueOrThrow({ where: { id: BOOK }, select: { categoryId: true } });
    return book.categoryId;
  }

  it("takes money off only the lines it covers, and says why when there are none", async () => {
    signInAs("admin");
    const created = await createPromoCode(
      jsonRequest("POST", "/api/admin/promo-codes", {
        code: "BOOKS10",
        description: "",
        kind: "percent",
        value: "10",
        maxDiscount: "",
        minSubtotal: "400000",
        startsOn: "",
        endsOn: "",
        usageLimit: "",
        perGuestLimit: "",
        isActive: true,
        categoryIds: [await bookCategory()],
        productIds: [],
        firstOrderOnly: false,
      }),
    );
    expect(created.status).toBe(201);
    const promo = await readJson<PromoCode>(created);
    expect(promo.categoryIds).toHaveLength(1);
    const logged = await prisma.activityEntry.findFirstOrThrow({ where: { action: "promoCode.created" } });
    expect(JSON.stringify(logged.changes)).toContain("categoryIds");

    const coffeeOnly = await guestQuote({ items: [{ productId: "seed-espresso", quantity: 5 }], promoCode: "BOOKS10" });
    expect(coffeeOnly.status).toBe(409);
    expect((await readError(coffeeOnly)).code).toBe("PROMO_NOT_ELIGIBLE");

    const mixed = await guestQuote({
      items: [
        { productId: BOOK, quantity: 1 },
        { productId: "seed-espresso", quantity: 1 },
      ],
      promoCode: "BOOKS10",
    });
    expect(mixed.status).toBe(200);
    // 10% of the 420,000 book, not of the espresso; its 400,000 minimum met by the book alone.
    expect(await readJson<OrderQuote>(mixed)).toMatchObject({ promoDiscount: 42_000, total: 473_000 });
  });

  it("re-prices a scoped code when staff change the order, refusing a change that leaves nothing it covers", async () => {
    await prisma.promoCode.create({
      data: { code: "BOOKS10", kind: "percent", value: 10, categoryIds: [await bookCategory()] },
    });
    signInAs("customer");
    const placed = await placeOrder(
      jsonRequest("POST", "/api/orders", {
        items: [
          { productId: BOOK, quantity: 1 },
          { productId: "seed-espresso", quantity: 1 },
        ],
        serviceType: "takeaway",
        promoCode: "BOOKS10",
      }),
    );
    expect(placed.status).toBe(201);
    const order = await readJson<Order>(placed);
    const bookLine = order.items.find((item) => item.productId === BOOK);

    signInAs("staff");
    const added = await changeOrder(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}`, { add: [{ productId: "seed-espresso", quantity: 1 }] }),
      routeParams({ id: order.id }),
    );
    expect(added.status).toBe(200);
    expect(await readJson<Order>(added)).toMatchObject({ promoDiscount: 42_000, total: 568_000 });

    const removed = await changeOrder(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}`, { lines: [{ itemId: bookLine?.id, quantity: 0 }] }),
      routeParams({ id: order.id }),
    );
    expect(removed.status).toBe(409);
    expect((await readError(removed)).code).toBe("PROMO_NO_LONGER_APPLIES");
  });

  it("keeps a first-order code for a guest whose profile has no completed order", async () => {
    await prisma.promoCode.create({ data: { code: "HELLO", kind: "fixed", value: 20_000, firstOrderOnly: true } });
    const items = [{ productId: "seed-espresso", quantity: 1 }];

    expect((await guestQuote({ items, promoCode: "HELLO" })).status).toBe(200);

    await prisma.order.create({
      data: {
        userId: GUEST.id,
        customerName: GUEST.name,
        customerPhone: GUEST.phone,
        serviceType: "takeaway",
        status: "completed",
        subtotal: 95_000,
        total: 95_000,
      },
    });
    const refused = await guestQuote({ items, promoCode: "HELLO" });
    expect(refused.status).toBe(409);
    expect((await readError(refused)).code).toBe("PROMO_FIRST_ORDER");

    signInAs("customer");
    const placed = await placeOrder(
      jsonRequest("POST", "/api/orders", { items, serviceType: "takeaway", promoCode: "HELLO" }),
    );
    expect(placed.status).toBe(409);
  });
});

describe("the service charge", () => {
  async function setServiceCharge(rate: string): Promise<AccountingSettings> {
    signInAs("owner");
    const response = await saveAccountingSettings(
      jsonRequest("PUT", "/api/admin/accounting/settings", {
        vatRate: "10",
        serviceChargeRate: rate,
        booksClosedThrough: "",
      }),
    );
    expect(response.status).toBe(200);
    return readJson<AccountingSettings>(response);
  }

  async function placeDineIn(): Promise<Order> {
    signInAs("customer");
    const response = await placeOrder(
      jsonRequest("POST", "/api/orders", {
        items: [{ productId: "seed-espresso", quantity: 2 }],
        serviceType: "dineIn",
        tableLabel: "4",
      }),
    );
    expect(response.status).toBe(201);
    return readJson<Order>(response);
  }

  it("is off by default, and set beside the VAT rate by accounting, logged", async () => {
    const order = await placeDineIn();
    expect(order).toMatchObject({ serviceCharge: 0, total: 190_000 });

    expect(await setServiceCharge("10")).toMatchObject({ vatRateBps: 1000, serviceChargeBps: 1000 });
    const entry = await prisma.activityEntry.findFirstOrThrow({ where: { action: "ledger.settingsChanged" } });
    expect(entry.changes).toEqual([{ field: "serviceChargeBps", before: "0", after: "1000" }]);

    signInAs("staff");
    const refused = await saveAccountingSettings(
      jsonRequest("PUT", "/api/admin/accounting/settings", { vatRate: "10", serviceChargeRate: "5" }),
    );
    expect(refused.status).toBe(401);
  });

  it("is charged on dine-in orders only, shown in the quote and snapshotted on the order", async () => {
    await setServiceCharge("10");
    const items = [{ productId: "seed-espresso", quantity: 2 }];

    expect(await readJson<OrderQuote>(await guestQuote({ items, serviceType: "dineIn" }))).toMatchObject({
      serviceCharge: 19_000,
      serviceChargeBps: 1000,
      total: 209_000,
    });
    expect(await readJson<OrderQuote>(await guestQuote({ items, serviceType: "takeaway" }))).toMatchObject({
      serviceCharge: 0,
      total: 190_000,
    });

    const order = await placeDineIn();
    expect(order).toMatchObject({ subtotal: 190_000, serviceCharge: 19_000, serviceChargeBps: 1000, total: 209_000 });

    // A rate changed later leaves the order alone.
    await setServiceCharge("12.5");
    signInAs("staff");
    const changed = await changeOrder(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}`, { add: [{ productId: "seed-espresso", quantity: 1 }] }),
      routeParams({ id: order.id }),
    );
    expect(await readJson<Order>(changed)).toMatchObject({ serviceCharge: 28_500, total: 313_500 });
    // Moved to takeaway while unpaid, the charge goes.
    const takeaway = await changeOrder(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}`, { serviceType: "takeaway" }),
      routeParams({ id: order.id }),
    );
    expect(await readJson<Order>(takeaway)).toMatchObject({ serviceCharge: 0, total: 285_000 });
  });

  it("is booked as service charge income with its VAT, earns no points, and comes back with a refund", async () => {
    await setServiceCharge("10");
    const order = await placeDineIn();
    await setStatus(order.id, "preparing");
    await setStatus(order.id, "completed");
    await payCash(order.id);

    // VAT on the espressos and the charge: 19,000 inside 209,000, 1,727 of it in the charge.
    expect(await creditBalance("4600")).toBe(17_273);
    expect(await creditBalance("4100")).toBe(172_727);
    expect(await creditBalance("2200")).toBe(19_000);
    // 19 points on the 190,000 of coffee — none on the charge.
    expect(await pointsOf(GUEST.id)).toBe(19);

    signInAs("admin");
    const refunded = await refundOrder(
      jsonRequest("POST", `/api/admin/orders/${order.id}/refunds`, {
        lines: [{ itemId: order.items[0].id, quantity: 1, restock: false }],
        method: "cash",
      }),
      routeParams({ id: order.id }),
    );
    expect(refunded.status).toBe(201);
    const refund = await prisma.orderRefundLine.findFirstOrThrow();
    // Half the order: its half of the charge, and of the VAT inside it.
    expect(refund).toMatchObject({ amount: 104_500, serviceCharge: 9_500, serviceChargeVat: 863 });
    expect(await creditBalance("4600")).toBe(17_273 - (9_500 - 863));
    expect(await creditBalance("2200")).toBe(19_000 - refund.vatAmount);
  });

  it("is taken back out when a served order nobody paid for is written off", async () => {
    await setServiceCharge("10");
    const order = await placeDineIn();
    await setStatus(order.id, "preparing");
    await setStatus(order.id, "completed");
    expect(await creditBalance("4600")).toBe(17_273);

    signInAs("admin");
    const response = await writeOffOrder(
      jsonRequest("POST", `/api/admin/orders/${order.id}/write-off`, {}),
      routeParams({ id: order.id }),
    );
    expect(response.status).toBe(200);
    expect(await creditBalance("4600")).toBe(0);
  });
});

describe("loyalty settings, adjustments and expiry", () => {
  it("logs a change to the club's rules and a manual adjustment", async () => {
    signInAs("admin");
    const saved = await saveLoyaltySettings(
      jsonRequest("PUT", "/api/admin/loyalty/settings", {
        enabled: true,
        tomanPerPoint: 10_000,
        pointValue: 1_000,
        minRedeemPoints: 50,
        pointsExpiryMonths: 12,
      }),
    );
    expect(saved.status).toBe(200);
    const settings = await readJson<LoyaltySettings>(saved);
    expect(settings.pointsExpiryMonths).toBe(12);
    expect(settings.pointsExpirySince).toBeDefined();
    const changed = await prisma.activityEntry.findFirstOrThrow({ where: { action: "loyalty.settingsChanged" } });
    expect(changed).toMatchObject({ entityType: "loyalty", actorId: TEST_USERS.admin.id });
    expect(changed.changes).toEqual([{ field: "pointsExpiryMonths", before: "0", after: "12" }]);

    const adjusted = await adjustPoints(
      jsonRequest("POST", "/api/admin/loyalty/adjustments", { phone: GUEST.phone, delta: 30, note: "Birthday" }),
    );
    expect(adjusted.status).toBe(201);
    const entry = await prisma.activityEntry.findFirstOrThrow({ where: { action: "loyalty.pointsAdjusted" } });
    expect(entry).toMatchObject({ entityType: "loyalty", entityId: GUEST.id });
    expect(entry.changes).toEqual([
      { field: "points", before: null, after: "30" },
      { field: "note", before: null, after: "Birthday" },
    ]);
  });

  it("lapses idle points as a ledger entry, warns before, tells the guest, and shows when on /rewards", async () => {
    const now = new Date();
    const DAY = 24 * 60 * 60 * 1000;
    await prisma.loyaltySettings.update({
      where: { id: 1 },
      data: { pointsExpiryMonths: 6, pointsExpirySince: new Date("2020-01-01T00:00:00Z") },
    });
    const idle = TEST_USERS.staff.id;
    const soon = TEST_USERS.admin.id;
    await givePoints(idle, 100, new Date(now.getTime() - 400 * DAY));
    // Six months less a few days ago: lapses within the warning days.
    const almost = new Date(now);
    almost.setUTCMonth(almost.getUTCMonth() - 6);
    await givePoints(soon, 40, new Date(almost.getTime() + 5 * DAY));
    await givePoints(GUEST.id, 70);

    const job = new ExpireLoyaltyPoints(loyaltyRepository, customerNotifier);
    expect(await job.execute(now)).toBe(1);
    expect(await pointsOf(idle)).toBe(0);
    expect(
      await prisma.loyaltyTransaction.findFirstOrThrow({ where: { userId: idle, reason: "expire" } }),
    ).toMatchObject({ delta: -100, createdByName: "System" });
    expect(await pointsOf(soon)).toBe(40);
    expect(await pointsOf(GUEST.id)).toBe(70);

    const sent = await prisma.notification.findMany({ select: { userId: true, kind: true }, orderBy: { kind: "asc" } });
    expect(sent).toEqual([
      { userId: idle, kind: "pointsExpired" },
      { userId: soon, kind: "pointsExpiring" },
    ]);
    expect(await prisma.activityEntry.count({ where: { action: "loyalty.pointsExpired", entityId: idle } })).toBe(1);

    // Safe to run again: nothing more lapses, nobody is told twice.
    expect(await job.execute(now)).toBe(0);
    expect(await prisma.notification.count()).toBe(2);

    signInAs("customer");
    const overview = await readJson<GuestLoyaltyOverview>(await getLoyalty());
    expect(overview.balance).toBe(70);
    expect(overview.settings.pointsExpiryMonths).toBe(6);
    expect(new Date(overview.expiresAt ?? 0).getTime()).toBeGreaterThan(now.getTime() + 150 * DAY);
  });
});
