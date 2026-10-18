import { describe, expect, it } from "vitest";

import { PATCH as setPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { GET as getAdminOrder } from "@/app/api/admin/orders/[id]/route";
import { PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as cancelOrder } from "@/app/api/orders/[id]/cancel/route";
import { GET as getOwnOrder } from "@/app/api/orders/[id]/route";
import { POST as quoteOrder } from "@/app/api/orders/quote/route";
import { GET as listOwnOrders, POST as placeOrder } from "@/app/api/orders/route";
import type { Order } from "@/src/domain/entities/Order";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const takeaway = {
  items: [
    { productId: "seed-espresso", quantity: 2 },
    { productId: "seed-cappuccino", quantity: 1, note: "Oat milk" },
  ],
  serviceType: "takeaway",
};

async function placeAs(user: "customer" | "staff", body: unknown = takeaway): Promise<Order> {
  signInAs(user);
  const response = await placeOrder(jsonRequest("POST", "/api/orders", body));
  expect(response.status).toBe(201);
  return readJson<Order>(response);
}

async function moveTo(orderId: string, status: string): Promise<Response> {
  return changeStatus(
    jsonRequest("PATCH", `/api/admin/orders/${orderId}/status`, { status }),
    routeParams({ id: orderId }),
  );
}

describe("placing an order", () => {
  it("needs a signed-in guest", async () => {
    const response = await placeOrder(jsonRequest("POST", "/api/orders", takeaway));

    expect(response.status).toBe(401);
  });

  it("validates the basket with 400 and field errors", async () => {
    signInAs("customer");
    const response = await placeOrder(jsonRequest("POST", "/api/orders", { items: [], serviceType: "dineIn" }));

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({
      items: "itemsRequired",
      tableLabel: "tableRequired",
    });
  });

  it("prices every line from the menu, not the request, and takes the stock", async () => {
    const order = await placeAs("customer", {
      ...takeaway,
      // A client-supplied price must be ignored.
      items: [{ productId: "seed-espresso", quantity: 2, price: 1 }],
    });

    expect(order).toMatchObject({
      status: "pending",
      paymentStatus: "unpaid",
      userId: "09120000004",
      customerName: "Test Guest",
      subtotal: 2 * 95000,
      total: 2 * 95000,
    });
    expect(order.items[0]).not.toHaveProperty("unitCost");
    const espresso = await prisma.product.findUniqueOrThrow({ where: { id: "seed-espresso" } });
    expect(espresso.stockQuantity).toBe(198);
  });

  it("caps a line's quantity with 400", async () => {
    signInAs("customer");
    const response = await placeOrder(
      jsonRequest("POST", "/api/orders", {
        items: [{ productId: "seed-espresso", quantity: 51 }],
        serviceType: "takeaway",
      }),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ items: "quantityMax" });
    expect(await prisma.order.count()).toBe(0);
  });

  it("refuses an item that sold out with 409", async () => {
    await prisma.product.update({ where: { id: "seed-espresso" }, data: { stockQuantity: 1 } });
    signInAs("customer");
    const response = await placeOrder(
      jsonRequest("POST", "/api/orders", {
        items: [{ productId: "seed-espresso", quantity: 2 }],
        serviceType: "takeaway",
      }),
    );

    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("INSUFFICIENT_STOCK");
  });

  it("quotes the basket without placing anything", async () => {
    signInAs("customer");
    const response = await quoteOrder(jsonRequest("POST", "/api/orders/quote", { items: takeaway.items }));

    expect(response.status).toBe(200);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("a guest's own orders", () => {
  it("lists and reads only the guest's own orders", async () => {
    const order = await placeAs("customer");

    const list = await listOwnOrders();
    expect((await readJson<Order[]>(list)).map(({ id }) => id)).toEqual([order.id]);

    const own = await getOwnOrder(getRequest(`/api/orders/${order.id}`), routeParams({ id: order.id }));
    expect(own.status).toBe(200);

    // Someone else's order reads as missing, not forbidden — its existence isn't leaked.
    signInAs("staff");
    const other = await getOwnOrder(getRequest(`/api/orders/${order.id}`), routeParams({ id: order.id }));
    expect(other.status).toBe(404);
  });

  it("lets the guest cancel a pending order and puts the stock back", async () => {
    const order = await placeAs("customer");

    const response = await cancelOrder(
      jsonRequest("POST", `/api/orders/${order.id}/cancel`),
      routeParams({ id: order.id }),
    );

    expect(response.status).toBe(200);
    expect((await readJson<Order>(response)).status).toBe("cancelled");
    const espresso = await prisma.product.findUniqueOrThrow({ where: { id: "seed-espresso" } });
    expect(espresso.stockQuantity).toBe(200);
  });

  it("won't let the guest cancel once staff are preparing it (409)", async () => {
    const order = await placeAs("customer");
    signInAs("staff");
    expect((await moveTo(order.id, "accepted")).status).toBe(200);

    signInAs("customer");
    const response = await cancelOrder(
      jsonRequest("POST", `/api/orders/${order.id}/cancel`),
      routeParams({ id: order.id }),
    );

    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("INVALID_TRANSITION");
  });
});

describe("staff working an order", () => {
  it("moves an order through the workflow and records each step", async () => {
    const order = await placeAs("customer");
    signInAs("staff");

    for (const status of ["accepted", "preparing", "ready"]) {
      const response = await moveTo(order.id, status);
      expect(response.status, status).toBe(200);
      expect((await readJson<Order>(response)).status).toBe(status);
    }

    const events = await prisma.orderStatusEvent.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => event.toStatus)).toEqual(["pending", "accepted", "preparing", "ready"]);
  });

  it("refuses a transition the workflow doesn't allow (409)", async () => {
    const order = await placeAs("customer");
    signInAs("staff");

    const response = await moveTo(order.id, "completed");

    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("INVALID_TRANSITION");
  });

  it("rejects an unknown status with 400", async () => {
    const order = await placeAs("customer");
    signInAs("staff");

    const response = await moveTo(order.id, "teleported");

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ status: "statusInvalid" });
  });

  it("answers 404 for an order that doesn't exist", async () => {
    signInAs("staff");

    expect((await moveTo("00000000-0000-0000-0000-000000000000", "accepted")).status).toBe(404);
  });

  it("keeps guests and support out of the workflow", async () => {
    const order = await placeAs("customer");

    expect((await moveTo(order.id, "accepted")).status).toBe(401);
    const adminRead = await getAdminOrder(getRequest(`/api/admin/orders/${order.id}`), routeParams({ id: order.id }));
    expect(adminRead.status).toBe(401);
  });

  it("marks an order paid and posts the sale to the ledger", async () => {
    const order = await placeAs("customer");
    signInAs("staff");

    const response = await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, { paymentStatus: "paid", paymentMethod: "cash" }),
      routeParams({ id: order.id }),
    );

    expect(response.status).toBe(200);
    expect(await readJson<Order>(response)).toMatchObject({ paymentStatus: "paid", paymentMethod: "cash" });
    // Opening stock is the seed's only entry; the payment adds at least one more.
    expect(await prisma.journalEntry.count()).toBeGreaterThan(1);
  });

  it("requires the method when marking paid (400)", async () => {
    const order = await placeAs("customer");
    signInAs("staff");

    const response = await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, { paymentStatus: "paid" }),
      routeParams({ id: order.id }),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ paymentMethod: "methodRequired" });
  });
});
