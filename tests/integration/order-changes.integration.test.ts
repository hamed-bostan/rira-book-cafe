import { describe, expect, it } from "vitest";

import { PATCH as setItemServed } from "@/app/api/admin/orders/[id]/items/[itemId]/route";
import { PATCH as setPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { PATCH as changeOrder } from "@/app/api/admin/orders/[id]/route";
import { GET as listStatusEvents, PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { GET as getOwnOrder } from "@/app/api/orders/[id]/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import type { Order } from "@/src/domain/entities/Order";
import type { OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { orderRepository } from "@/src/infrastructure/container";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const CAKE = "seed-carrot-cake";
const GUEST = TEST_USERS.customer.id;
const STAFF = { id: TEST_USERS.staff.id, name: TEST_USERS.staff.name };

/** A guest's dine-in order: two espressos (95,000) and a slice of cake (120,000, counted). */
async function placeAsGuest(body: Record<string, unknown> = {}): Promise<Order> {
  signInAs("customer");
  const response = await placeOrder(
    jsonRequest("POST", "/api/orders", {
      items: [
        { productId: "seed-espresso", quantity: 2 },
        { productId: CAKE, quantity: 1 },
      ],
      serviceType: "dineIn",
      tableLabel: "4",
      ...body,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Order>(response);
}

async function change(orderId: string, body: unknown, as: "staff" | "customer" | null = "staff"): Promise<Response> {
  signInAs(as);
  return changeOrder(jsonRequest("PATCH", `/api/admin/orders/${orderId}`, body), routeParams({ id: orderId }));
}

async function moveTo(orderId: string, status: string): Promise<void> {
  signInAs("staff");
  const response = await changeStatus(
    jsonRequest("PATCH", `/api/admin/orders/${orderId}/status`, { status }),
    routeParams({ id: orderId }),
  );
  expect(response.status).toBe(200);
}

async function stockOf(productId: string): Promise<number> {
  return (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;
}

describe("changing an order after it's placed", () => {
  it("is staff's, with orders.fulfill", async () => {
    const order = await placeAsGuest();

    expect((await change(order.id, { tableLabel: "9" }, null)).status).toBe(401);
    expect((await change(order.id, { tableLabel: "9" }, "customer")).status).toBe(401);
    expect((await change(order.id, { tableLabel: "9" })).status).toBe(200);
  });

  it("adds a round: priced from the menu, its stock taken, logged, on the timeline, and the guest told", async () => {
    const order = await placeAsGuest();
    expect(await stockOf(CAKE)).toBe(17);
    const journal = await prisma.journalEntry.count();

    const response = await change(order.id, {
      version: order.updatedAt,
      add: [{ productId: CAKE, quantity: 2, note: " warm it up " }],
    });

    expect(response.status).toBe(200);
    const changed = await readJson<Order>(response);
    expect(changed.items).toHaveLength(3);
    expect(changed.items[2]).toMatchObject({ productId: CAKE, quantity: 2, unitPrice: 120000, note: "warm it up" });
    expect(changed.items[2].addedAt).toBeDefined();
    expect(changed.items[0].addedAt).toBeUndefined();
    expect(changed).toMatchObject({ subtotal: 550000, total: 550000 });
    expect(changed.changedAt).toBeDefined();
    expect(await stockOf(CAKE)).toBe(15);

    // Nothing of an unpaid, unserved order is on the books, so a change books nothing.
    expect(await prisma.journalEntry.count()).toBe(journal);

    const log = await prisma.activityEntry.findFirstOrThrow({ where: { action: "order.changed", entityId: order.id } });
    expect(log).toMatchObject({ actorId: STAFF.id, entityLabel: `#${order.orderNumber}` });
    expect(log.changes).toEqual([
      { field: "linesAdded", before: null, after: "2× Carrot Cake (warm it up)" },
      { field: "total", before: "310000", after: "550000" },
    ]);

    signInAs("staff");
    const events = await readJson<OrderStatusEvent[]>(
      await listStatusEvents(getRequest(`/api/admin/orders/${order.id}/status`), routeParams({ id: order.id })),
    );
    expect(events.map((event) => [event.kind, event.from, event.to])).toEqual([
      ["status", null, "pending"],
      ["changed", "pending", "pending"],
    ]);

    const notice = await prisma.notification.findFirstOrThrow({ where: { kind: "orderChanged" } });
    expect(notice).toMatchObject({ userId: GUEST, link: `/orders/${order.id}` });
  });

  it("lowers and takes off lines, putting counted units back on the shelf", async () => {
    const order = await placeAsGuest();
    const [espresso, cake] = order.items;

    const response = await change(order.id, {
      lines: [
        { itemId: espresso.id, quantity: 1 },
        { itemId: cake.id, quantity: 0 },
      ],
    });

    expect(response.status).toBe(200);
    const changed = await readJson<Order>(response);
    expect(changed.items.map((item) => [item.productId, item.quantity])).toEqual([["seed-espresso", 1]]);
    expect(changed).toMatchObject({ subtotal: 95000, total: 95000 });
    expect(await stockOf(CAKE)).toBe(18);
    expect(await prisma.orderItem.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("refuses to leave nothing on the order", async () => {
    const order = await placeAsGuest();

    const response = await change(order.id, {
      lines: order.items.map((item) => ({ itemId: item.id, quantity: 0 })),
    });

    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("ORDER_EMPTY");
    expect(await stockOf(CAKE)).toBe(17);
  });

  it("keeps a line that went out to the guest", async () => {
    const order = await placeAsGuest();
    await moveTo(order.id, "preparing");
    const cake = order.items[1];
    signInAs("staff");
    await setItemServed(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/items/${cake.id}`, { served: true }),
      routeParams({ id: order.id, itemId: cake.id }),
    );

    const response = await change(order.id, { lines: [{ itemId: cake.id, quantity: 0 }] });

    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("ITEM_SERVED");
    expect(await prisma.orderItem.count({ where: { orderId: order.id } })).toBe(2);
  });

  it("won't change a paid order's lines, but still moves it", async () => {
    const order = await placeAsGuest();
    signInAs("staff");
    await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, { paymentStatus: "paid", paymentMethod: "cash" }),
      routeParams({ id: order.id }),
    );

    const add = await change(order.id, { add: [{ productId: "seed-espresso", quantity: 1 }] });
    expect(add.status).toBe(409);
    expect((await readError(add)).code).toBe("ORDER_LINES_LOCKED");

    const move = await change(order.id, { serviceType: "takeaway" });
    expect(move.status).toBe(200);
    const moved = await readJson<Order>(move);
    expect(moved).toMatchObject({ serviceType: "takeaway", total: 310000, paymentStatus: "paid" });
    expect(moved.tableLabel).toBeUndefined();
  });

  it("changes nothing on a served order", async () => {
    const order = await placeAsGuest();
    await moveTo(order.id, "preparing");
    await moveTo(order.id, "completed");

    const response = await change(order.id, { tableLabel: "9" });

    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("ORDER_CLOSED");
  });

  it("refuses a round the shelf can't cover, changing nothing", async () => {
    const order = await placeAsGuest();

    const response = await change(order.id, { add: [{ productId: CAKE, quantity: 18 }] });

    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("INSUFFICIENT_STOCK");
    expect(await stockOf(CAKE)).toBe(17);
    expect(await prisma.orderItem.count({ where: { orderId: order.id } })).toBe(2);
  });

  it("validates the change with 400 and field errors", async () => {
    const order = await placeAsGuest();

    const response = await change(order.id, { serviceType: "dineIn", tableLabel: " " });

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ tableLabel: "tableRequired" });
  });

  it("books the changed order's sale once it's served", async () => {
    const order = await placeAsGuest();
    await change(order.id, { lines: [{ itemId: order.items[0].id, quantity: 1 }] });
    await moveTo(order.id, "preparing");
    await moveTo(order.id, "completed");

    const sale = await prisma.journalEntry.findFirstOrThrow({
      where: { uniqueKey: `order:${order.id}:sale` },
      include: { lines: true },
    });
    const receivable = sale.lines.find((line) => line.accountCode === "1150");
    expect(Number(receivable?.debit)).toBe(95000 + 120000);
  });
});

describe("two staff changing one order at once", () => {
  it("lets the first in and refuses the second, rather than overwriting it", async () => {
    const order = await placeAsGuest();

    const [first, second] = await Promise.all([
      change(order.id, { version: order.updatedAt, tableLabel: "7" }),
      change(order.id, { version: order.updatedAt, tableLabel: "8" }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect((await readError(loser)).code).toBe("INVALID_TRANSITION");
    const table = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).tableLabel;
    expect(["7", "8"]).toContain(table);
    expect(await prisma.activityEntry.count({ where: { action: "order.changed" } })).toBe(1);
  });

  it("refuses a change worked out from a copy someone else has since changed", async () => {
    const order = await placeAsGuest();
    expect((await change(order.id, { tableLabel: "7" })).status).toBe(200);

    // A change priced from the order as it was read before that.
    await expect(
      orderRepository.change(
        {
          orderId: order.id,
          expected: { updatedAt: order.updatedAt, status: order.status, paymentStatus: order.paymentStatus },
          lower: [],
          add: [],
          serviceType: "dineIn",
          tableLabel: "8",
        },
        STAFF,
      ),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).tableLabel).toBe("7");
  });

  it("won't book a payment taken for the order's total before its lines changed", async () => {
    const order = await placeAsGuest();
    await change(order.id, { add: [{ productId: "seed-espresso", quantity: 1 }] });

    await expect(
      orderRepository.setPaymentStatus(order.id, {
        from: "unpaid",
        to: "paid",
        parts: [{ method: "online", amount: order.total }],
        total: order.total,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("unpaid");
  });
});

describe("re-pricing a changed order", () => {
  it("refuses a change its promo code's minimum no longer covers", async () => {
    await prisma.promoCode.create({ data: { code: "BIGTABLE", kind: "fixed", value: 50000, minSubtotal: 300000 } });
    const order = await placeAsGuest({ promoCode: "bigtable" });
    expect(order).toMatchObject({ promoCode: "BIGTABLE", promoDiscount: 50000, total: 260000 });

    const lowered = await change(order.id, { lines: [{ itemId: order.items[0].id, quantity: 1 }] });
    expect(lowered.status).toBe(409);
    expect((await readError(lowered)).code).toBe("PROMO_NO_LONGER_APPLIES");

    // A bigger order keeps its code — its own use isn't counted against it.
    await prisma.promoCode.update({ where: { code: "BIGTABLE" }, data: { perGuestLimit: 1 } });
    const added = await change(order.id, { add: [{ productId: "seed-espresso", quantity: 1 }] });
    expect(added.status).toBe(200);
    expect(await readJson<Order>(added)).toMatchObject({ subtotal: 405000, promoDiscount: 50000, total: 355000 });
  });

  it("refuses a change the points already spent would cover more than", async () => {
    await prisma.loyaltyTransaction.create({ data: { userId: GUEST, delta: 300, reason: "adjust" } });
    const order = await placeAsGuest({ redeemPoints: true });
    expect(order).toMatchObject({ pointsRedeemed: 300, pointsDiscount: 300000, total: 10000 });

    const lowered = await change(order.id, { lines: [{ itemId: order.items[1].id, quantity: 0 }] });
    expect(lowered.status).toBe(409);
    expect((await readError(lowered)).code).toBe("POINTS_EXCEED_TOTAL");

    // A round on top keeps the points and spends no more of them.
    const added = await change(order.id, { add: [{ productId: "seed-espresso", quantity: 1 }] });
    expect(await readJson<Order>(added)).toMatchObject({ pointsRedeemed: 300, pointsDiscount: 300000, total: 105000 });
  });
});

describe("a counter sale's guest", () => {
  it("hears of a change on the profile the phone found, and can open the order it links to", async () => {
    signInAs("staff");
    const sale = await readJson<Order>(
      await ringUpSale(
        jsonRequest("POST", "/api/admin/orders", {
          items: [{ productId: "seed-espresso", quantity: 1 }],
          serviceType: "takeaway",
          customerName: "Walk-in guest",
          customerPhone: "0912 000 0004",
        }),
      ),
    );

    await change(sale.id, { add: [{ productId: "seed-espresso", quantity: 1 }] });

    const notice = await prisma.notification.findFirstOrThrow({ where: { kind: "orderChanged" } });
    expect(notice).toMatchObject({ userId: GUEST, link: `/orders/${sale.id}` });
    signInAs("customer");
    expect((await getOwnOrder(getRequest("/"), routeParams({ id: sale.id }))).status).toBe(200);
    // Someone else still reads it as missing.
    signInAs("staff");
    expect((await getOwnOrder(getRequest("/"), routeParams({ id: sale.id }))).status).toBe(404);
  });
});
