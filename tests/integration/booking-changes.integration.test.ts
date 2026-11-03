import { describe, expect, it } from "vitest";

import { POST as cancelEvent } from "@/app/api/admin/events/[id]/cancel/route";
import { DELETE as cancelSignUp } from "@/app/api/admin/events/[id]/registrations/[registrationId]/route";
import { PATCH as editReservation } from "@/app/api/admin/reservations/[id]/details/route";
import { PATCH as changeReservation } from "@/app/api/admin/reservations/[id]/route";
import { GET as readFloor } from "@/app/api/admin/reservations/floor/route";
import { GET as listReservations, POST as bookTable } from "@/app/api/admin/reservations/route";
import { PATCH as editStay } from "@/app/api/admin/suite-bookings/[id]/details/route";
import { PATCH as changeStay } from "@/app/api/admin/suite-bookings/[id]/route";
import { POST as bookSuite } from "@/app/api/admin/suite-bookings/route";
import { POST as register } from "@/app/api/events/[id]/registrations/route";
import { DELETE as deleteEvent, PUT as updateEvent } from "@/app/api/events/[id]/route";
import { POST as createEvent } from "@/app/api/events/route";
import { GET as myReservations, POST as requestTable } from "@/app/api/reservations/route";
import type { CafeEvent, EventRegistration } from "@/src/domain/entities/CafeEvent";
import { cafeDayOf, dateToWallTime, shiftCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import type { Floor } from "@/src/domain/entities/FloorAvailability";
import type { Reservation } from "@/src/domain/entities/Reservation";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const nextWeek = shiftCafeDay(today, 7);
const dayAfter = shiftCafeDay(nextWeek, 1);
const GUEST = TEST_USERS.customer;
const WALK_IN = { guestName: "Omid Karimi", guestPhone: "0935 640 1182" };
const QUARTER_MS = 15 * 60 * 1000;

function staffBooking(body: Record<string, unknown>): Promise<Response> {
  signInAs("staff");
  return bookTable(jsonRequest("POST", "/api/admin/reservations", { ...WALK_IN, partySize: 2, ...body }));
}

function patchDetails(id: string, body: unknown): Promise<Response> {
  return editReservation(jsonRequest("PATCH", `/api/admin/reservations/${id}/details`, body), routeParams({ id }));
}

function patchReservation(id: string, body: unknown): Promise<Response> {
  return changeReservation(jsonRequest("PATCH", `/api/admin/reservations/${id}`, body), routeParams({ id }));
}

async function listDay(day: string): Promise<Reservation[]> {
  signInAs("staff");
  return readJson<Reservation[]>(await listReservations(getRequest(`/api/admin/reservations?day=${day}`)));
}

/** A guest's own request, confirmed by staff at a table. */
async function guestBookingAt(wallTime: string, tableLabel: string): Promise<Reservation> {
  signInAs("customer");
  const asked = await requestTable(jsonRequest("POST", "/api/reservations", { startsAt: wallTime, partySize: 2 }));
  expect(asked.status).toBe(201);
  const booking = await readJson<Reservation>(asked);
  signInAs("staff");
  const confirmed = await patchReservation(booking.id, { status: "confirmed", tableLabel });
  expect(confirmed.status).toBe(200);
  return readJson<Reservation>(confirmed);
}

function noticesFor(userId: string, kind: string) {
  return prisma.notification.findMany({ where: { userId, kind }, orderBy: { createdAt: "asc" } });
}

describe("booking a table at any hour", () => {
  it("takes a guest's request for the small hours and for late at night", async () => {
    signInAs("customer");
    for (const time of ["00:00", "02:45", "23:45"]) {
      const response = await requestTable(
        jsonRequest("POST", "/api/reservations", { startsAt: `${nextWeek}T${time}`, partySize: 2 }),
      );
      expect(response.status).toBe(201);
    }
    // Still on a quarter hour.
    const offMark = await requestTable(
      jsonRequest("POST", "/api/reservations", { startsAt: `${nextWeek}T23:50`, partySize: 2 }),
    );
    expect(offMark.status).toBe(400);
  });

  it("keeps a booking at 23:30 on the day it starts, holding its table past midnight", async () => {
    const late = await guestBookingAt(`${nextWeek}T23:30`, "3");

    // The day view: on the day it starts, not the next.
    expect((await listDay(nextWeek)).map((booking) => booking.id)).toContain(late.id);
    expect((await listDay(dayAfter)).map((booking) => booking.id)).not.toContain(late.id);

    // The table is held until 01:00: a booking at 00:30 clashes, one at 01:00 doesn't.
    const clash = await staffBooking({ startsAt: `${dayAfter}T00:30`, tableLabel: "3" });
    expect(clash.status).toBe(409);
    expect((await readError(clash)).code).toBe("TABLE_TAKEN");
    expect((await staffBooking({ startsAt: `${dayAfter}T01:00`, tableLabel: "3" })).status).toBe(201);

    // The next day's floor shows it, so its pickers grey the table out.
    const floor = await readJson<Floor>(await readFloor(getRequest(`/api/admin/reservations/floor?day=${dayAfter}`)));
    expect(floor.bookings.map((booking) => booking.id)).toContain(late.id);
    expect(floor.bookings.every((booking) => !("guestName" in booking))).toBe(true);

    // The guest's own list has it, at 23:30.
    signInAs("customer");
    const mine = await readJson<Reservation[]>(await myReservations());
    expect(dateToWallTime(new Date(mine.find((booking) => booking.id === late.id)?.startsAt ?? ""))).toBe(
      `${nextWeek}T23:30`,
    );
  });

  it("checks the floor's day, and keeps it to staff", async () => {
    signInAs("staff");
    expect((await readFloor(getRequest("/api/admin/reservations/floor?day=next-week"))).status).toBe(400);
    signInAs("customer");
    expect((await readFloor(getRequest(`/api/admin/reservations/floor?day=${today}`))).status).toBe(401);
  });
});

describe("editing a table booking", () => {
  it("moves a guest's booking to another day, shows it in their list, logs it and tells them", async () => {
    const booking = await guestBookingAt(`${nextWeek}T19:00`, "3");

    signInAs("staff");
    const response = await patchDetails(booking.id, { startsAt: `${dayAfter}T20:15`, durationMinutes: 120 });
    expect(response.status).toBe(200);
    const moved = await readJson<Reservation>(response);
    expect(moved).toMatchObject({ durationMinutes: 120, tableLabel: "3", status: "confirmed" });
    expect(dateToWallTime(new Date(moved.startsAt))).toBe(`${dayAfter}T20:15`);

    signInAs("customer");
    const mine = await readJson<Reservation[]>(await myReservations());
    expect(mine.find((one) => one.id === booking.id)?.startsAt).toBe(moved.startsAt);

    const [notice] = await noticesFor(GUEST.id, "reservationChanged");
    expect(notice).toMatchObject({ link: "/reservations" });
    expect(notice.params).toMatchObject({
      reference: booking.reference,
      startsAt: moved.startsAt,
      durationMinutes: 120,
    });

    const entry = await prisma.activityEntry.findFirst({
      where: { entityId: booking.id, action: "reservation.changed", changedFields: { has: "startsAt" } },
    });
    expect(entry?.changes).toEqual([
      { field: "startsAt", before: booking.startsAt, after: moved.startsAt },
      { field: "durationMinutes", before: "90", after: "120" },
    ]);
  });

  it("tells a phone guest on the profile made for them, and keeps the guest as booked", async () => {
    const booked = await readJson<Reservation>(await staffBooking({ startsAt: `${nextWeek}T12:00` }));
    // The guest isn't a detail to edit: a guest's name or phone sent along is ignored.
    const response = await patchDetails(booked.id, { partySize: 5, guestPhone: "0935 640 9999", guestName: "X" });
    expect(response.status).toBe(200);
    expect(await readJson<Reservation>(response)).toMatchObject({
      userId: "09356401182",
      guestName: "Omid Karimi",
      guestPhone: "0935 640 1182",
      partySize: 5,
    });
    expect(await noticesFor("09356401182", "reservationChanged")).toHaveLength(1);
  });

  it("refuses a table someone else has at the new time, and leaves the booking as it was", async () => {
    await staffBooking({ startsAt: `${dayAfter}T19:00`, tableLabel: "5" });
    const mine = await readJson<Reservation>(await staffBooking({ startsAt: `${nextWeek}T19:00`, tableLabel: "5" }));

    const moved = await patchDetails(mine.id, { startsAt: `${dayAfter}T19:30` });
    expect(moved.status).toBe(409);
    expect((await readError(moved)).code).toBe("TABLE_TAKEN");
    // A longer booking that runs into the next one is refused the same way.
    await staffBooking({ startsAt: `${nextWeek}T21:00`, tableLabel: "5" });
    const longer = await patchDetails(mine.id, { durationMinutes: 180 });
    expect(longer.status).toBe(409);

    expect(await prisma.reservation.findUnique({ where: { id: mine.id } })).toMatchObject({
      startsAt: new Date(mine.startsAt),
      durationMinutes: 90,
    });
  });

  it("lets a seated party change only its length and table", async () => {
    // A walk-in at the quarter hour already running, seated straight away.
    const thisQuarter = dateToWallTime(new Date(Math.floor(Date.now() / QUARTER_MS) * QUARTER_MS));
    const booked = await readJson<Reservation>(await staffBooking({ startsAt: thisQuarter, tableLabel: "6" }));
    expect((await patchReservation(booked.id, { status: "seated" })).status).toBe(200);

    const moved = await patchDetails(booked.id, { startsAt: `${nextWeek}T19:00` });
    expect(moved.status).toBe(400);
    expect((await readError(moved)).fieldErrors).toHaveProperty("startsAt");

    const longer = await patchDetails(booked.id, { durationMinutes: 180, tableLabel: "7" });
    expect(longer.status).toBe(200);
    expect(await readJson<Reservation>(longer)).toMatchObject({ durationMinutes: 180, tableLabel: "7" });
  });

  it("validates the details with message keys, and refuses a finished booking", async () => {
    const booked = await readJson<Reservation>(await staffBooking({ startsAt: `${nextWeek}T12:00` }));
    const bad = await patchDetails(booked.id, { durationMinutes: 45, partySize: 13 });
    expect(bad.status).toBe(400);
    expect((await readError(bad)).fieldErrors).toEqual({
      durationMinutes: "lengthInvalid",
      partySize: "partySizeInvalid",
    });

    const past = await patchDetails(booked.id, { startsAt: `${shiftCafeDay(today, -1)}T12:00` });
    expect(past.status).toBe(400);

    expect((await patchReservation(booked.id, { status: "cancelled" })).status).toBe(200);
    const late = await patchDetails(booked.id, { partySize: 3 });
    expect(late.status).toBe(409);
    expect((await readError(late)).code).toBe("INVALID_TRANSITION");
  });

  it("is staff-only", async () => {
    const booked = await readJson<Reservation>(await staffBooking({ startsAt: `${nextWeek}T12:00` }));
    signInAs("customer");
    expect((await patchDetails(booked.id, { partySize: 3 })).status).toBe(401);
    signInAs(null);
    expect((await patchDetails(booked.id, { partySize: 3 })).status).toBe(401);
  });
});

describe("editing a suite stay", () => {
  async function stay(checkIn: string, nights = 2): Promise<SuiteBooking> {
    signInAs("staff");
    const response = await bookSuite(
      jsonRequest("POST", "/api/admin/suite-bookings", {
        ...WALK_IN,
        checkIn,
        checkOut: shiftCafeDay(checkIn, nights),
        guests: 2,
        note: "",
      }),
    );
    expect(response.status).toBe(201);
    return readJson<SuiteBooking>(response);
  }

  function patchStay(id: string, body: unknown): Promise<Response> {
    return editStay(jsonRequest("PATCH", `/api/admin/suite-bookings/${id}/details`, body), routeParams({ id }));
  }

  it("extends a checked-in stay, and refuses moving its arrival", async () => {
    const inNow = await stay(today);
    expect(
      (
        await changeStay(
          jsonRequest("PATCH", `/api/admin/suite-bookings/${inNow.id}`, { status: "checkedIn" }),
          routeParams({ id: inNow.id }),
        )
      ).status,
    ).toBe(200);

    const extended = await patchStay(inNow.id, { checkOut: shiftCafeDay(today, 5) });
    expect(extended.status).toBe(200);
    expect(await readJson<SuiteBooking>(extended)).toMatchObject({
      checkOut: shiftCafeDay(today, 5),
      status: "checkedIn",
    });
    expect(await noticesFor("09356401182", "suiteChanged")).toHaveLength(1);

    const moved = await patchStay(inNow.id, { checkIn: shiftCafeDay(today, 1) });
    expect(moved.status).toBe(400);
    expect((await readError(moved)).fieldErrors).toHaveProperty("checkIn");
  });

  it("refuses nights another stay holds, under the overlap check", async () => {
    const first = await stay(nextWeek);
    await stay(shiftCafeDay(nextWeek, 4));

    const onto = await patchStay(first.id, { checkOut: shiftCafeDay(nextWeek, 5) });
    expect(onto.status).toBe(409);
    expect((await readError(onto)).code).toBe("SUITE_TAKEN");
    // Up to the other's arrival is fine: a check-out on that day doesn't clash.
    expect((await patchStay(first.id, { checkOut: shiftCafeDay(nextWeek, 4), guests: 3 })).status).toBe(200);
  });

  it("checks the days with message keys, and is staff-only", async () => {
    const booked = await stay(nextWeek);
    const backwards = await patchStay(booked.id, { checkIn: nextWeek, checkOut: nextWeek });
    expect(backwards.status).toBe(400);
    expect((await readError(backwards)).fieldErrors).toEqual({ checkOut: "checkOutBeforeCheckIn" });

    signInAs("customer");
    expect((await patchStay(booked.id, { guests: 1 })).status).toBe(401);
  });
});

describe("event changes reaching guests", () => {
  const reading = {
    kind: "reading",
    title: "Poetry night",
    description: "",
    titleFa: "شب شعر",
    descriptionFa: "",
    imageUrl: "",
    startsAt: `${nextWeek}T17:00`,
    endsAt: `${nextWeek}T19:00`,
    capacity: "",
    price: "100000",
    isPublished: true,
  };

  async function eventWithGuest(): Promise<{ event: CafeEvent; registration: EventRegistration }> {
    signInAs("admin");
    const created = await createEvent(jsonRequest("POST", "/api/events", reading));
    expect(created.status).toBe(201);
    const event = await readJson<CafeEvent>(created);
    signInAs("customer");
    const signedUp = await register(
      jsonRequest("POST", `/api/events/${event.id}/registrations`, { seats: 2 }),
      routeParams({ id: event.id }),
    );
    expect(signedUp.status).toBe(201);
    return { event, registration: await readJson<EventRegistration>(signedUp) };
  }

  function putEvent(id: string, body: unknown): Promise<Response> {
    signInAs("admin");
    return updateEvent(jsonRequest("PUT", `/api/events/${id}`, body), routeParams({ id }));
  }

  it("tells the guests signed up when it moves, once per change, and when it's unpublished", async () => {
    const { event } = await eventWithGuest();

    expect(
      (await putEvent(event.id, { ...reading, startsAt: `${dayAfter}T17:00`, endsAt: `${dayAfter}T19:00` })).status,
    ).toBe(200);
    // A save that doesn't move it again tells nobody.
    expect(
      (
        await putEvent(event.id, {
          ...reading,
          startsAt: `${dayAfter}T17:00`,
          endsAt: `${dayAfter}T19:00`,
          price: "150000",
        })
      ).status,
    ).toBe(200);
    const moved = await noticesFor(GUEST.id, "eventMoved");
    expect(moved).toHaveLength(1);
    expect(moved[0].params).toMatchObject({
      title: "Poetry night",
      titleFa: "شب شعر",
      startsAt: wallTimeToDate(`${dayAfter}T17:00`).toISOString(),
    });

    expect((await putEvent(event.id, { ...reading, isPublished: false })).status).toBe(200);
    expect(await noticesFor(GUEST.id, "eventOff")).toHaveLength(1);
  });

  it("tells a guest when staff cancel their sign-up", async () => {
    const { event, registration } = await eventWithGuest();
    signInAs("admin");
    const response = await cancelSignUp(
      jsonRequest("DELETE", `/api/admin/events/${event.id}/registrations/${registration.id}`),
      routeParams({ id: event.id, registrationId: registration.id }),
    );
    expect(response.status).toBe(200);
    expect(await noticesFor(GUEST.id, "eventRegistrationCancelled")).toHaveLength(1);
  });

  it("calls an event off: every sign-up cancelled, unpublished, everyone told, and then it can go", async () => {
    const { event, registration } = await eventWithGuest();

    signInAs("staff");
    expect(
      (await cancelEvent(jsonRequest("POST", `/api/admin/events/${event.id}/cancel`), routeParams({ id: event.id })))
        .status,
    ).toBe(401);

    signInAs("admin");
    const response = await cancelEvent(
      jsonRequest("POST", `/api/admin/events/${event.id}/cancel`),
      routeParams({ id: event.id }),
    );
    expect(response.status).toBe(200);
    expect(await readJson<CafeEvent>(response)).toMatchObject({ isPublished: false, seatsTaken: 0 });
    expect(await prisma.eventRegistration.findUnique({ where: { id: registration.id } })).toMatchObject({
      status: "cancelled",
    });

    const [notice] = await noticesFor(GUEST.id, "eventCancelled");
    expect(notice).toMatchObject({ link: "/events", dedupeKey: `registration:${registration.id}:cancelled` });
    expect(await prisma.activityEntry.count({ where: { entityId: event.id, action: "event.cancelled" } })).toBe(1);

    // Nobody is signed up any more, so it can be deleted.
    const deleted = await deleteEvent(jsonRequest("DELETE", `/api/events/${event.id}`), routeParams({ id: event.id }));
    expect(deleted.status).toBe(204);
  });

  it("won't call off an event that's over", async () => {
    signInAs("admin");
    const past = await prisma.event.create({
      data: {
        kind: "reading",
        title: "Last week's reading",
        startsAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60 * 60 * 1000),
        price: 0,
        isPublished: true,
      },
    });
    const response = await cancelEvent(
      jsonRequest("POST", `/api/admin/events/${past.id}/cancel`),
      routeParams({ id: past.id }),
    );
    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("EVENT_CLOSED");
  });
});
