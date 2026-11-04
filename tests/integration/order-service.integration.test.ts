import { describe, expect, it } from "vitest";

import { GET as listNotes, POST as addNote } from "@/app/api/admin/orders/[id]/notes/route";
import { PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { PATCH as bulkUpdate } from "@/app/api/admin/orders/bulk/route";
import { GET as statusCounts } from "@/app/api/admin/orders/counts/route";
import { GET as listOrders, POST as ringUpSale } from "@/app/api/admin/orders/route";
import type { OrderStatusCounts } from "@/src/domain/entities/AdminOrderFilters";
import type { Order } from "@/src/domain/entities/Order";
import type { OrderNote } from "@/src/domain/entities/OrderNote";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * The Service group's routes no other suite drives: internal notes, the list's bulk
 * bar, and the status tabs' counts.
 */

async function ringUp(): Promise<Order> {
  signInAs("staff");
  const response = await ringUpSale(
    jsonRequest("POST", "/api/admin/orders", {
      items: [{ productId: "seed-espresso", quantity: 1 }],
      serviceType: "takeaway",
      customerPhone: "0912 555 0141",
      customerName: "Sara Walk-in",
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Order>(response);
}

async function moveTo(orderId: string, status: string): Promise<void> {
  const response = await changeStatus(
    jsonRequest("PATCH", `/api/admin/orders/${orderId}/status`, { status }),
    routeParams({ id: orderId }),
  );
  expect(response.status).toBe(200);
}

function bulk(ids: string[], action: unknown): Promise<Response> {
  return bulkUpdate(jsonRequest("PATCH", "/api/admin/orders/bulk", { ids, action }));
}

async function stored(id: string) {
  return prisma.order.findUniqueOrThrow({ where: { id } });
}

describe("internal notes", () => {
  function post(orderId: string, body: unknown): Promise<Response> {
    return addNote(jsonRequest("POST", `/api/admin/orders/${orderId}/notes`, body), routeParams({ id: orderId }));
  }

  it("adds a note signed by the session's user, and lists the newest first", async () => {
    const order = await ringUp();

    expect((await post(order.id, { body: "Left a scarf" })).status).toBe(201);
    // The author is the session's, whatever the body claims.
    const second = await post(order.id, { body: "  Collected it  ", authorId: "someone-else" });
    expect(second.status).toBe(201);
    expect(await readJson<OrderNote>(second)).toMatchObject({ body: "Collected it", authorId: "09120000003" });

    const notes = await readJson<OrderNote[]>(
      await listNotes(getRequest(`/api/admin/orders/${order.id}/notes`), routeParams({ id: order.id })),
    );
    expect(notes.map((note) => note.body)).toEqual(["Collected it", "Left a scarf"]);
  });

  it("refuses an empty note (400), an unknown order (404) and a guest (401)", async () => {
    const order = await ringUp();

    const empty = await post(order.id, { body: "   " });
    expect(empty.status).toBe(400);
    expect((await readError(empty)).fieldErrors).toMatchObject({ body: "noteRequired" });
    expect((await post("no-such-order", { body: "Hello" })).status).toBe(404);

    signInAs("customer");
    expect((await post(order.id, { body: "Hello" })).status).toBe(401);
    expect(await prisma.orderNote.count({ where: { orderId: order.id } })).toBe(0);
  });
});

describe("the list's bulk bar", () => {
  it("serves only the ticked orders being made", async () => {
    const making = await ringUp();
    const waiting = await ringUp();
    await moveTo(making.id, "preparing");

    const response = await bulk([making.id, waiting.id], { type: "serve" });

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ updated: 1 });
    expect((await stored(making.id)).status).toBe("completed");
    expect((await stored(waiting.id)).status).toBe("pending");
  });

  it("marks the unpaid ones paid by one method and books each sale", async () => {
    const one = await ringUp();
    const two = await ringUp();
    const cashBefore = await prisma.journalLine.count({ where: { accountCode: "1110" } });

    const response = await bulk([one.id, two.id], { type: "markPaid", paymentMethod: "cash" });

    expect(await readJson(response)).toEqual({ updated: 2 });
    for (const id of [one.id, two.id]) {
      expect(await stored(id)).toMatchObject({ paymentStatus: "paid", paymentMethod: "cash" });
    }
    expect(await prisma.journalLine.count({ where: { accountCode: "1110" } })).toBe(cashBefore + 2);

    // Already paid: nothing left to change.
    expect(await readJson(await bulk([one.id], { type: "markPaid", paymentMethod: "card" }))).toEqual({ updated: 0 });
    expect((await stored(one.id)).paymentMethod).toBe("cash");
  });

  it("cancels the ticked orders still open, and leaves served ones alone", async () => {
    const open = await ringUp();
    const served = await ringUp();
    await moveTo(served.id, "preparing");
    await moveTo(served.id, "completed");

    expect(await readJson(await bulk([open.id, served.id], { type: "cancel" }))).toEqual({ updated: 1 });
    expect((await stored(open.id)).status).toBe("cancelled");
    expect((await stored(served.id)).status).toBe("completed");
  });

  it("keeps guests out (401)", async () => {
    const order = await ringUp();
    signInAs("customer");

    expect((await bulk([order.id], { type: "cancel" })).status).toBe(401);
    expect((await stored(order.id)).status).toBe("pending");
  });
});

describe("searching the list", () => {
  async function search(q: string): Promise<Response> {
    return listOrders(getRequest(`/api/admin/orders?q=${encodeURIComponent(q)}`));
  }

  it("finds an order by the guest's whole phone number — all digits, but not an order number", async () => {
    const order = await ringUp();

    // Rung up as "0912 555 0141"; staff type it however they like.
    for (const q of ["09125550141", "0912 555 0141", "+98 912 555 0141"]) {
      const response = await search(q);
      expect(response.status).toBe(200);
      expect((await readJson<{ items: Order[] }>(response)).items.map((item) => item.id)).toEqual([order.id]);
    }
  });

  it("still finds an order by its number, with or without the #", async () => {
    const order = await ringUp();
    await ringUp();

    for (const q of [String(order.orderNumber), `#${order.orderNumber}`]) {
      const ids = (await readJson<{ items: Order[] }>(await search(q))).items.map((item) => item.id);
      expect(ids).toContain(order.id);
    }
  });
});

describe("the status tabs' counts", () => {
  it("counts every order per status, with the open ones as active", async () => {
    const pending = await ringUp();
    const making = await ringUp();
    const cancelled = await ringUp();
    await moveTo(making.id, "preparing");
    await moveTo(cancelled.id, "cancelled");
    expect(pending.status).toBe("pending");

    const counts = await readJson<OrderStatusCounts>(await statusCounts());

    expect(counts).toMatchObject({ pending: 1, preparing: 1, cancelled: 1, completed: 0, active: 2 });

    signInAs("customer");
    expect((await statusCounts()).status).toBe(401);
  });
});
