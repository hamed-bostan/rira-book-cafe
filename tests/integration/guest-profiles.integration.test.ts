import { describe, expect, it } from "vitest";

import { GET as lookUpGuest } from "@/app/api/admin/guests/route";
import { PATCH as changeOrderStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { PATCH as changeReservation } from "@/app/api/admin/reservations/[id]/route";
import { POST as bookTable } from "@/app/api/admin/reservations/route";
import { POST as bookSuite } from "@/app/api/admin/suite-bookings/route";
import { GET as listNotifications } from "@/app/api/notifications/route";
import { GET as ownOrders } from "@/app/api/orders/route";
import { GET as ownReservations } from "@/app/api/reservations/route";
import { GET as ownStays } from "@/app/api/suite-bookings/route";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Notification } from "@/src/domain/entities/Notification";
import type { Order } from "@/src/domain/entities/Order";
import type { Reservation } from "@/src/domain/entities/Reservation";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { PLACEHOLDER_USER_NAME } from "@/src/domain/entities/User";
import { VerifyOtp } from "@/src/domain/use-cases/auth/VerifyOtp";
import { GetOrCreateUser } from "@/src/domain/use-cases/profile/GetOrCreateUser";
import { authRepository, userRepository } from "@/src/infrastructure/container";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs, signInAsUser } from "./helpers/session";

const nextWeek = shiftCafeDay(cafeDayOf(new Date()), 7);

/** A guest the cafe has never seen, as staff type their number. */
const NEW_GUEST = { phone: "+98 935 222 0101", id: "09352220101", name: "Parisa Ghasemi" };

function lookUp(phone: string): Promise<Response> {
  return lookUpGuest(getRequest(`/api/admin/guests?phone=${encodeURIComponent(phone)}`));
}

function table(body: Record<string, unknown>): Promise<Response> {
  signInAs("staff");
  return bookTable(
    jsonRequest("POST", "/api/admin/reservations", { startsAt: `${nextWeek}T19:00`, partySize: 2, ...body }),
  );
}

function stay(body: Record<string, unknown>, checkIn = shiftCafeDay(nextWeek, 30)): Promise<Response> {
  signInAs("staff");
  return bookSuite(
    jsonRequest("POST", "/api/admin/suite-bookings", {
      checkIn,
      checkOut: shiftCafeDay(checkIn, 2),
      guests: 2,
      ...body,
    }),
  );
}

function sale(body: Record<string, unknown>): Promise<Response> {
  signInAs("staff");
  return ringUpSale(
    jsonRequest("POST", "/api/admin/orders", {
      items: [{ productId: "seed-espresso", quantity: 1 }],
      serviceType: "takeaway",
      ...body,
    }),
  );
}

/** The profiles staff made, as the activity log has them. */
function profilesLogged() {
  return prisma.activityEntry.findMany({
    where: { action: "guest.profileCreated" },
    select: { actorId: true, entityType: true, entityId: true, entityLabel: true },
  });
}

describe("looking a guest up by phone", () => {
  it("is for staff who record things for guests", async () => {
    signInAs(null);
    expect((await lookUp("09120000004")).status).toBe(401);
    signInAs("customer");
    expect((await lookUp("09120000004")).status).toBe(401);
    signInAs("staff");
    expect((await lookUp("09120000004")).status).toBe(200);
  });

  it("says whose the phone is and whether they've signed in, and nothing more", async () => {
    signInAs("staff");
    // The test guest has signed in; the number typed however finds them.
    expect(await readJson(await lookUp("+98 912 000 0004"))).toEqual({
      found: true,
      name: TEST_USERS.customer.name,
      signedIn: true,
    });
    expect(await readJson(await lookUp(NEW_GUEST.phone))).toEqual({ found: false });

    await prisma.user.create({ data: { id: "09352220102", phone: "09352220102", name: PLACEHOLDER_USER_NAME } });
    expect(await readJson(await lookUp("۰۹۳۵ ۲۲۲ ۰۱۰۲"))).toEqual({ found: true, name: null, signedIn: false });
  });

  it("refuses a number nobody could have", async () => {
    signInAs("staff");
    const response = await lookUp("12 34");
    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toEqual({ phone: "phoneInvalid" });
  });
});

describe("a guest staff record something for", () => {
  it("gets a profile with their first booking, logged as made by that member of staff", async () => {
    const response = await table({ guestPhone: NEW_GUEST.phone, guestName: NEW_GUEST.name });
    expect(response.status).toBe(201);
    expect(await readJson<Reservation>(response)).toMatchObject({ userId: NEW_GUEST.id, guestName: NEW_GUEST.name });

    expect(await prisma.user.findUniqueOrThrow({ where: { id: NEW_GUEST.id } })).toMatchObject({
      phone: NEW_GUEST.phone,
      name: NEW_GUEST.name,
      role: "customer",
      createdById: TEST_USERS.staff.id,
      firstSignedInAt: null,
    });
    expect(await profilesLogged()).toEqual([
      { actorId: TEST_USERS.staff.id, entityType: "guest", entityId: NEW_GUEST.id, entityLabel: NEW_GUEST.name },
    ]);
  });

  it("is found again by phone on every later record, under the profile's own name", async () => {
    await table({ guestPhone: NEW_GUEST.phone, guestName: NEW_GUEST.name });

    const booked = await readJson<SuiteBooking>(await stay({ guestPhone: "0935 222 0101", guestName: "Someone" }));
    expect(booked).toMatchObject({ userId: NEW_GUEST.id, guestName: NEW_GUEST.name, guestPhone: "0935 222 0101" });
    const sold = await readJson<Order>(await sale({ customerPhone: "09352220101" }));
    expect(sold).toMatchObject({ userId: NEW_GUEST.id, customerName: NEW_GUEST.name });

    expect(await prisma.user.count({ where: { id: NEW_GUEST.id } })).toBe(1);
    expect(await profilesLogged()).toHaveLength(1);
  });

  it("gets one on a stay or a sale too", async () => {
    expect((await stay({ guestPhone: "0935 222 0103", guestName: "Kian" })).status).toBe(201);
    expect((await sale({ customerPhone: "0935 222 0104", customerName: "Mina" })).status).toBe(201);
    expect((await profilesLogged()).map((entry) => entry.entityId).sort()).toEqual(["09352220103", "09352220104"]);
  });

  it("never gets a profile from a record that's refused — it's made in the record's transaction", async () => {
    // A table already taken then.
    expect((await table({ guestPhone: "09352220201", guestName: "First", tableLabel: "4" })).status).toBe(201);
    const taken = await table({ guestPhone: "09352220202", guestName: "Second", tableLabel: "4" });
    expect(taken.status).toBe(409);
    // Nights another stay holds.
    expect((await stay({ guestPhone: "09352220203", guestName: "Third" })).status).toBe(201);
    expect((await stay({ guestPhone: "09352220204", guestName: "Fourth" })).status).toBe(409);
    // A book that's sold out.
    const soldOut = await sale({
      items: [{ productId: "seed-book-blind-owl", quantity: 50 }],
      customerPhone: "09352220205",
      customerName: "Fifth",
    });
    expect(soldOut.status).toBe(409);

    const made = await prisma.user.findMany({ where: { id: { startsWith: "0935222020" } }, select: { id: true } });
    expect(made.map((user) => user.id).sort()).toEqual(["09352220201", "09352220203"]);
    expect((await profilesLogged()).map((entry) => entry.entityId).sort()).toEqual(["09352220201", "09352220203"]);
  });

  it("needs a phone on every sale", async () => {
    const response = await sale({ customerName: "Walk-in guest" });
    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toEqual({ customerPhone: "phoneRequired" });
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("a guest staff made a profile for", () => {
  /** The first sign-in, the way `auth.ts` runs it. */
  async function signIn(typedPhone: string): Promise<void> {
    await authRepository.requestOtp(typedPhone);
    const code = authRepository.peekDevOtp?.(typedPhone) ?? "";
    const identity = await new VerifyOtp(authRepository).execute(typedPhone, code);
    if (!identity) throw new Error("The mock code didn't verify.");
    signInAsUser(await new GetOrCreateUser(userRepository).execute(identity));
  }

  it("signs in to it, and finds their booking, stay, order and messages there", async () => {
    const booking = await readJson<Reservation>(
      await table({ guestPhone: NEW_GUEST.phone, guestName: NEW_GUEST.name }),
    );
    await changeReservation(
      jsonRequest("PATCH", `/api/admin/reservations/${booking.id}`, { status: "confirmed", tableLabel: "3" }),
      routeParams({ id: booking.id }),
    );
    await stay({ guestPhone: NEW_GUEST.phone });
    const order = await readJson<Order>(await sale({ customerPhone: NEW_GUEST.phone }));
    await changeOrderStatus(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/status`, { status: "preparing" }),
      routeParams({ id: order.id }),
    );

    await signIn("0935 222 0101");

    const profile = await prisma.user.findUniqueOrThrow({ where: { id: NEW_GUEST.id } });
    expect(profile.name).toBe(NEW_GUEST.name);
    expect(profile.firstSignedInAt).toBeInstanceOf(Date);
    expect((await readJson<Reservation[]>(await ownReservations())).map((r) => r.id)).toEqual([booking.id]);
    expect(await readJson<SuiteBooking[]>(await ownStays())).toHaveLength(1);
    expect((await readJson<Order[]>(await ownOrders())).map((o) => o.id)).toEqual([order.id]);
    const messages = await readJson<Notification[]>(await listNotifications());
    expect(messages.map((message) => [message.kind, message.link]).sort()).toEqual([
      ["orderAccepted", `/orders/${order.id}`],
      ["reservationConfirmed", "/reservations"],
    ]);

    // Signing in again keeps the first sign-in.
    const first = profile.firstSignedInAt;
    await signIn(NEW_GUEST.phone);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: NEW_GUEST.id } })).firstSignedInAt).toEqual(first);
    signInAs("staff");
    expect(await readJson(await lookUp(NEW_GUEST.phone))).toEqual({
      found: true,
      name: NEW_GUEST.name,
      signedIn: true,
    });
  });
});
