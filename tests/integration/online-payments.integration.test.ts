import { describe, expect, it } from "vitest";

import { PATCH as updateOnlinePayment } from "@/app/api/admin/online-payments/[id]/route";
import { GET as listUnapplied } from "@/app/api/admin/online-payments/unapplied/route";
import { GET as listOrderOnlinePayments } from "@/app/api/admin/orders/[id]/online-payments/route";
import { PATCH as setPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import type { Order } from "@/src/domain/entities/Order";
import type { OrderPaymentAttempt } from "@/src/domain/entities/PaymentAttempt";
import type { GatewayVerification, IPaymentGateway } from "@/src/domain/repositories/IPaymentGateway";
import { VerifyOnlinePayment } from "@/src/domain/use-cases/payments/OnlinePayment";
import { orderRepository, paymentAttemptRepository } from "@/src/infrastructure/container";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** Net debits − credits on an account, across everything posted. */
async function balanceOf(accountCode: string): Promise<number> {
  const sum = await prisma.journalLine.aggregate({ where: { accountCode }, _sum: { debit: true, credit: true } });
  return Number(sum._sum.debit ?? 0) - Number(sum._sum.credit ?? 0);
}

async function placeAsGuest(): Promise<Order> {
  signInAs("customer");
  const response = await placeOrder(
    jsonRequest("POST", "/api/orders", {
      items: [{ productId: "seed-espresso", quantity: 2 }],
      serviceType: "takeaway",
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Order>(response);
}

/** Staff take the money at the counter — in cash. */
async function markPaidInCash(orderId: string): Promise<void> {
  signInAs("staff");
  const response = await setPayment(
    jsonRequest("PATCH", `/api/admin/orders/${orderId}/payment`, { paymentStatus: "paid", paymentMethod: "cash" }),
    routeParams({ id: orderId }),
  );
  expect(response.status).toBe(200);
}

/** A gateway that confirms the payment, after `during` has run (a counter payment racing it, say). */
function gatewayConfirming(during: () => Promise<void> = async () => {}): IPaymentGateway {
  return {
    provider: "zarinpal",
    request: async () => ({ authority: "unused", redirectUrl: "https://example.test" }),
    verify: async (): Promise<GatewayVerification> => {
      await during();
      return { ok: true, refId: "50421", cardPan: "6037****1234", alreadyVerified: false };
    },
  };
}

/** The guest pays at the gateway and comes back: the callback, through the real repositories. */
async function payOnline(order: Order, gateway: IPaymentGateway, authority = `A${order.id}`): Promise<string> {
  await paymentAttemptRepository.open({ orderId: order.id, provider: "zarinpal", authority, amount: order.total });
  return new VerifyOnlinePayment(orderRepository, paymentAttemptRepository, gateway).execute({
    orderId: order.id,
    authority,
    completed: true,
  });
}

/** An online payment the gateway captured while staff took cash for the same order. */
async function unappliedPayment(): Promise<{ order: Order; attempt: OrderPaymentAttempt }> {
  const order = await placeAsGuest();
  expect(
    await payOnline(
      order,
      gatewayConfirming(() => markPaidInCash(order.id)),
    ),
  ).toBe("review");
  signInAs("staff");
  const attempts = await readJson<OrderPaymentAttempt[]>(await listUnapplied());
  return { order, attempt: attempts[0] };
}

function markGivenBack(id: string, body: unknown = { status: "refunded" }): Promise<Response> {
  return updateOnlinePayment(jsonRequest("PATCH", `/api/admin/online-payments/${id}`, body), routeParams({ id }));
}

describe("an online payment the order took", () => {
  it("is still booked by the gateway's callback to the gateway's clearing account", async () => {
    const order = await placeAsGuest();

    expect(await payOnline(order, gatewayConfirming())).toBe("paid");

    expect((await orderRepository.getById(order.id))?.paymentMethod).toBe("online");
    expect(await balanceOf("1130")).toBe(order.total);
  });

  it("can't be unmarked at the counter (409) — the gateway still holds it, so only a refund gives it back", async () => {
    const order = await placeAsGuest();
    expect(await payOnline(order, gatewayConfirming())).toBe("paid");

    signInAs("staff");
    const response = await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, { paymentStatus: "unpaid" }),
      routeParams({ id: order.id }),
    );

    expect(response.status).toBe(409);
    expect((await orderRepository.getById(order.id))?.paymentStatus).toBe("paid");
    expect(await balanceOf("1130")).toBe(order.total);
  });
});

describe("an online payment no order took", () => {
  it("is listed for the dashboard, with its order, until it's given back", async () => {
    const { order, attempt } = await unappliedPayment();

    expect(attempt).toMatchObject({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.total,
      status: "unapplied",
      refId: "50421",
      cardPan: "6037****1234",
    });
    // The order kept the cash; the gateway's capture never reached the books.
    expect(await balanceOf("1110")).toBe(order.total);
    expect(await balanceOf("1130")).toBe(0);

    const forOrder = await listOrderOnlinePayments(
      getRequest(`/api/admin/orders/${order.id}/online-payments`),
      routeParams({ id: order.id }),
    );
    expect((await readJson<OrderPaymentAttempt[]>(forOrder)).map((row) => row.id)).toEqual([attempt.id]);
  });

  it("is read with the dashboard, and closed to guests", async () => {
    const { order } = await unappliedPayment();
    signInAs("customer");

    expect((await listUnapplied()).status).toBe(401);
    const forOrder = await listOrderOnlinePayments(
      getRequest(`/api/admin/orders/${order.id}/online-payments`),
      routeParams({ id: order.id }),
    );
    expect(forOrder.status).toBe(401);
  });

  it("is marked given back by the books' people, not the floor", async () => {
    const { attempt } = await unappliedPayment();

    signInAs("staff");
    expect((await markGivenBack(attempt.id)).status).toBe(401);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe("unapplied");
  });

  it("leaves the list once given back, logged on the order, booking nothing", async () => {
    const { order, attempt } = await unappliedPayment();
    const entries = await prisma.journalEntry.count();
    signInAs("admin");

    const response = await markGivenBack(attempt.id);
    expect(response.status).toBe(200);
    expect(await readJson<OrderPaymentAttempt>(response)).toMatchObject({ id: attempt.id, status: "refunded" });

    expect(await readJson<OrderPaymentAttempt[]>(await listUnapplied())).toEqual([]);
    // The order's page still shows it, as given back.
    const forOrder = await listOrderOnlinePayments(
      getRequest(`/api/admin/orders/${order.id}/online-payments`),
      routeParams({ id: order.id }),
    );
    expect((await readJson<OrderPaymentAttempt[]>(forOrder)).map((row) => row.status)).toEqual(["refunded"]);

    expect(await prisma.journalEntry.count()).toBe(entries);
    const logged = await prisma.activityEntry.findFirstOrThrow({ where: { action: "order.onlinePaymentRefunded" } });
    expect(logged).toMatchObject({
      entityType: "order",
      entityId: order.id,
      entityLabel: `#${order.orderNumber}`,
      actorName: "Test Admin",
    });
    expect(logged.changes).toEqual([
      { field: "amount", before: null, after: String(order.total) },
      { field: "refId", before: null, after: "50421" },
    ]);

    // Only once.
    const again = await markGivenBack(attempt.id);
    expect(again.status).toBe(409);
    expect((await readError(again)).code).toBe("INVALID_TRANSITION");
  });

  it("can only be marked given back, and must exist", async () => {
    const { attempt } = await unappliedPayment();
    signInAs("admin");

    const wrong = await markGivenBack(attempt.id, { status: "paid" });
    expect(wrong.status).toBe(400);
    expect((await readError(wrong)).fieldErrors).toMatchObject({ status: "statusInvalid" });
    expect((await markGivenBack("00000000-0000-0000-0000-000000000000")).status).toBe(404);
  });

  it("can't mark a payment the order took", async () => {
    const order = await placeAsGuest();
    await payOnline(order, gatewayConfirming());
    const paid = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: order.id } });
    signInAs("admin");

    expect((await markGivenBack(paid.id)).status).toBe(409);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: paid.id } })).status).toBe("paid");
  });
});
