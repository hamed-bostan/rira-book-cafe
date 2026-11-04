import { describe, expect, it } from "vitest";

import { PATCH as setPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { GET as getAdminReceipt } from "@/app/api/admin/orders/[id]/receipt/route";
import { POST as refundOrder } from "@/app/api/admin/orders/[id]/refunds/route";
import { PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { GET as getOwnReceipt } from "@/app/api/orders/[id]/receipt/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import type { Order } from "@/src/domain/entities/Order";
import type { OrderReceipt } from "@/src/domain/entities/OrderReceipt";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** A guest's dine-in order: two espressos (95,000) and a slice of carrot cake (120,000), VAT inside. */
async function placeAsGuest(): Promise<Order> {
  signInAs("customer");
  const response = await placeOrder(
    jsonRequest("POST", "/api/orders", {
      items: [
        { productId: "seed-espresso", quantity: 2 },
        { productId: "seed-carrot-cake", quantity: 1 },
      ],
      serviceType: "dineIn",
      tableLabel: "4",
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Order>(response);
}

async function staffReceipt(orderId: string): Promise<Response> {
  return getAdminReceipt(getRequest(`/api/admin/orders/${orderId}/receipt`), routeParams({ id: orderId }));
}

async function ownReceipt(orderId: string): Promise<Response> {
  return getOwnReceipt(getRequest(`/api/orders/${orderId}/receipt`), routeParams({ id: orderId }));
}

describe("an order's receipt for staff", () => {
  it("needs the dashboard, and answers 404 for an order that isn't there", async () => {
    const order = await placeAsGuest();

    signInAs(null);
    expect((await staffReceipt(order.id)).status).toBe(401);
    signInAs("customer");
    expect((await staffReceipt(order.id)).status).toBe(401);
    signInAs("staff");
    expect((await staffReceipt("missing")).status).toBe(404);
  });

  it("prints the order, how it was paid, what came back, and the VAT the sale was booked with", async () => {
    const order = await placeAsGuest();
    signInAs("staff");
    for (const status of ["preparing", "completed"]) {
      await changeStatus(
        jsonRequest("PATCH", `/api/admin/orders/${order.id}/status`, { status }),
        routeParams({ id: order.id }),
      );
    }
    await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, {
        paymentStatus: "paid",
        paymentParts: [
          { method: "cash", amount: 100000 },
          { method: "card", amount: order.total - 100000 },
        ],
      }),
      routeParams({ id: order.id }),
    );
    signInAs("admin");
    await refundOrder(
      jsonRequest("POST", `/api/admin/orders/${order.id}/refunds`, {
        lines: [{ itemId: order.items[1].id, quantity: 1, restock: false }],
        method: "card",
      }),
      routeParams({ id: order.id }),
    );

    signInAs("staff");
    const response = await staffReceipt(order.id);
    expect(response.status).toBe(200);
    const receipt = await readJson<OrderReceipt>(response);

    const sale = await prisma.journalEntry.findFirstOrThrow({
      where: { uniqueKey: `order:${order.id}:sale` },
      include: { lines: true },
    });
    const bookedVat = Number(sale.lines.find((line) => line.accountCode === "2200")?.credit);
    expect(receipt.vatIncluded).toBe(bookedVat);
    expect(receipt.payments).toEqual([
      { method: "card", amount: order.total - 100000 },
      { method: "cash", amount: 100000 },
    ]);
    expect(receipt.refunds).toEqual([expect.objectContaining({ method: "card", amount: 120000 })]);
    expect(receipt.order.items[0]).toHaveProperty("unitPrice", 95000);
  });
});

describe("the guest's receipt", () => {
  it("is theirs only, without the costs", async () => {
    const order = await placeAsGuest();

    signInAs("customer");
    const own = await ownReceipt(order.id);
    expect(own.status).toBe(200);
    expect((await readJson<OrderReceipt>(own)).order.items[0]).not.toHaveProperty("unitCost");

    signInAs("staff");
    expect((await ownReceipt(order.id)).status).toBe(404);
    signInAs(null);
    expect((await ownReceipt(order.id)).status).toBe(401);
  });

  it("covers a sale rung up at the counter for their profile, by its phone", async () => {
    signInAs("staff");
    const sale = await readJson<Order>(
      await ringUpSale(
        jsonRequest("POST", "/api/admin/orders", {
          items: [{ productId: "seed-espresso", quantity: 1 }],
          serviceType: "takeaway",
          customerName: "Walk-in guest",
          customerPhone: "+98 912 000 0004",
        }),
      ),
    );

    signInAs("customer");
    expect((await ownReceipt(sale.id)).status).toBe(200);
  });
});
