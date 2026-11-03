import { describe, expect, it } from "vitest";

import { GET as getOverview } from "@/app/api/admin/analytics/overview/route";
import { PATCH as setPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { GET as listOrders } from "@/app/api/admin/orders/route";
import { GET as getSalesReport } from "@/app/api/admin/reports/sales/route";
import { GET as listReservations } from "@/app/api/admin/reservations/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import type { DailySales, DashboardOverview, SalesReport } from "@/src/domain/entities/Analytics";
import { cafeDayOf, cafeDayRange, shiftCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import type { Order } from "@/src/domain/entities/Order";
import type { Page } from "@/src/domain/entities/Pagination";
import { RESERVATION_STATUSES, type Reservation } from "@/src/domain/entities/Reservation";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const HOUR_MS = 60 * 60 * 1000;

/** A guest's takeaway order, placed now. */
async function placed(): Promise<Order> {
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

/** An order the bar has handed over — completed — and, when `paid`, settled in cash. */
async function served(paid: boolean): Promise<Order> {
  const order = await placed();
  signInAs("staff");
  for (const status of ["preparing", "completed"]) {
    const response = await changeStatus(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/status`, { status }),
      routeParams({ id: order.id }),
    );
    expect(response.status).toBe(200);
  }
  if (paid) {
    const response = await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, { paymentStatus: "paid", paymentMethod: "cash" }),
      routeParams({ id: order.id }),
    );
    expect(response.status).toBe(200);
  }
  return order;
}

/** Today's point of the last 7 days' sales, as the overview's money cards read it. */
async function todaysSales(): Promise<DailySales> {
  signInAs("admin");
  const response = await getSalesReport(getRequest("/api/admin/reports/sales?range=7d"));
  expect(response.status).toBe(200);
  const today = (await readJson<SalesReport>(response)).daily.at(-1);
  if (!today) throw new Error("the sales report has no days");
  return today;
}

async function overview(): Promise<DashboardOverview> {
  signInAs("staff");
  const response = await getOverview();
  expect(response.status).toBe(200);
  return readJson<DashboardOverview>(response);
}

/** A published event from `startsAt` to `endsAt`. */
async function eventAt(startsAt: Date, endsAt: Date, isPublished = true): Promise<void> {
  await prisma.event.create({ data: { kind: "workshop", title: "Latte art workshop", startsAt, endsAt, isPublished } });
}

describe("the dashboard overview", () => {
  it("is for anyone with the dashboard, and carries no queue count of its own", async () => {
    expect((await getOverview()).status).toBe(401);

    // The queue card reads the order list's total; the overview doesn't count it twice.
    expect(await overview()).not.toHaveProperty("activeOrders");
  });

  it("counts this week's events, one already under way included", async () => {
    const now = Date.now();
    const weekEnd = cafeDayRange(shiftCafeDay(cafeDayOf(new Date()), 7)).from.getTime();
    const before = (await overview()).upcomingEvents;

    // Counted: under way right now, and starting in three days.
    await eventAt(new Date(now - HOUR_MS), new Date(now + HOUR_MS));
    await eventAt(new Date(now + 72 * HOUR_MS), new Date(now + 74 * HOUR_MS));
    // Not counted: already over, starting after the week, and not published.
    await eventAt(new Date(now - 3 * HOUR_MS), new Date(now - HOUR_MS));
    await eventAt(new Date(weekEnd + HOUR_MS), new Date(weekEnd + 3 * HOUR_MS));
    await eventAt(new Date(now - HOUR_MS), new Date(now + HOUR_MS), false);

    expect((await overview()).upcomingEvents).toBe(before + 2);
  });

  it("counts today's bookings finished ones included, and the day's list holds every one of them", async () => {
    const today = cafeDayOf(new Date());
    const before = (await overview()).todayReservations;

    // One booking of each status at noon today, a party of 2 more each time.
    for (const [index, status] of RESERVATION_STATUSES.entries()) {
      await prisma.reservation.create({
        data: {
          guestName: "Sara",
          guestPhone: "09120000000",
          partySize: 2 + index * 2,
          startsAt: wallTimeToDate(`${today}T12:00`),
          durationMinutes: 90,
          status,
        },
      });
    }

    // Requested, confirmed, seated and completed — not the cancelled one (10) or the no-show (12).
    expect((await overview()).todayReservations).toEqual({
      bookings: before.bookings + 4,
      covers: before.covers + 2 + 4 + 6 + 8,
      awaitingConfirmation: before.awaitingConfirmation + 1,
    });

    // The overview lists the day from here and counts the finished ones under it,
    // linking to the Completed tab — which this same read fills.
    signInAs("staff");
    const response = await listReservations(getRequest(`/api/admin/reservations?day=${today}&status=completed`));
    expect(response.status).toBe(200);
    expect((await readJson<Reservation[]>(response)).map((reservation) => reservation.partySize)).toContain(8);
  });
});

describe("today's sales on the overview", () => {
  it("counts every order handed over, and says which of them are still unpaid", async () => {
    const before = await todaysSales();

    const unpaid = await served(false);
    const paid = await served(true);
    // Still in the queue: neither a sale nor money to collect yet.
    await placed();

    expect(await todaysSales()).toEqual({
      day: before.day,
      orders: before.orders + 2,
      revenue: before.revenue + unpaid.total + paid.total,
      unpaidOrders: before.unpaidOrders + 1,
      unpaidValue: before.unpaidValue + unpaid.total,
    });
  });

  it("links the unpaid ones to an order list that shows exactly those", async () => {
    const unpaid = await served(false);
    const paid = await served(true);
    const queued = await placed();

    signInAs("staff");
    const response = await listOrders(getRequest("/api/admin/orders?status=completed&payment=unpaid&pageSize=100"));
    expect(response.status).toBe(200);
    const ids = (await readJson<Page<Order>>(response)).items.map((order) => order.id);

    expect(ids).toContain(unpaid.id);
    expect(ids).not.toContain(paid.id);
    expect(ids).not.toContain(queued.id);
  });
});
