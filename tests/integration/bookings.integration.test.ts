import { describe, expect, it } from "vitest";

import { PATCH as changeReservation } from "@/app/api/admin/reservations/[id]/route";
import { GET as listReservations, POST as bookTable } from "@/app/api/admin/reservations/route";
import { PATCH as changeStay } from "@/app/api/admin/suite-bookings/[id]/route";
import { POST as bookSuite } from "@/app/api/admin/suite-bookings/route";
import { POST as requestTable } from "@/app/api/reservations/route";
import { cafeDayOf, shiftCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import type { Reservation } from "@/src/domain/entities/Reservation";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const nextWeek = shiftCafeDay(today, 7);

function askForTable(body: unknown): Promise<Response> {
  return requestTable(jsonRequest("POST", "/api/reservations", body));
}

function patchReservation(id: string, body: unknown): Promise<Response> {
  return changeReservation(jsonRequest("PATCH", `/api/admin/reservations/${id}`, body), routeParams({ id }));
}

/** A booking staff confirmed at table 3, starting at `startsAt` — written straight to the floor's book. */
function confirmedAt(startsAt: Date): Promise<{ id: string }> {
  return prisma.reservation.create({
    data: {
      guestName: "Sara Ahmadi",
      guestPhone: "09301184462",
      partySize: 2,
      startsAt,
      durationMinutes: 90,
      status: "confirmed",
      tableLabel: "3",
    },
    select: { id: true },
  });
}

/** A stay staff booked (so confirmed straight away) arriving on `checkIn`. */
async function stayFrom(checkIn: string): Promise<SuiteBooking> {
  signInAs("staff");
  const response = await bookSuite(
    jsonRequest("POST", "/api/admin/suite-bookings", {
      guestName: "Omid Karimi",
      guestPhone: "09356401182",
      checkIn,
      checkOut: shiftCafeDay(checkIn, 2),
      guests: 2,
      note: "",
    }),
  );
  expect(response.status).toBe(201);
  return readJson<SuiteBooking>(response);
}

function patchStay(id: string, body: unknown): Promise<Response> {
  return changeStay(jsonRequest("PATCH", `/api/admin/suite-bookings/${id}`, body), routeParams({ id }));
}

describe("the staff list of reservations", () => {
  it("lists the requests from a day on, whichever day they're for", async () => {
    signInAs("customer");
    const soon = await readJson<Reservation>(await askForTable({ startsAt: `${nextWeek}T19:00`, partySize: 2 }));
    const later = await readJson<Reservation>(
      await askForTable({ startsAt: `${shiftCafeDay(nextWeek, 14)}T12:00`, partySize: 4 }),
    );
    // One already answered, and a request from last week nobody will answer now.
    signInAs("staff");
    await bookTable(
      jsonRequest("POST", "/api/admin/reservations", {
        guestName: "Sara Ahmadi",
        guestPhone: "09301184462",
        startsAt: `${nextWeek}T12:00`,
        partySize: 2,
        tableLabel: "3",
      }),
    );
    await prisma.reservation.create({
      data: {
        userId: TEST_USERS.customer.id,
        guestName: "Test Guest",
        guestPhone: TEST_USERS.customer.phone,
        partySize: 2,
        startsAt: wallTimeToDate(`${shiftCafeDay(today, -7)}T19:00`),
        durationMinutes: 90,
      },
    });

    const response = await listReservations(getRequest(`/api/admin/reservations?from=${today}&status=requested`));

    expect(response.status).toBe(200);
    expect((await readJson<Reservation[]>(response)).map((reservation) => reservation.id)).toEqual([soon.id, later.id]);
  });

  it("takes a day or a starting day, not both, and checks each", async () => {
    signInAs("staff");
    for (const query of [`day=${today}&from=${today}`, "from=next-week", "from="]) {
      const response = await listReservations(getRequest(`/api/admin/reservations?${query}`));
      expect(response.status).toBe(400);
      expect((await readError(response)).code).toBe("VALIDATION");
    }
  });

  it("is staff-only", async () => {
    signInAs("customer");
    expect((await listReservations(getRequest(`/api/admin/reservations?from=${today}`))).status).toBe(401);
  });
});

describe("booking hours", () => {
  it("refuses a guest's request outside them, with a message key both languages have", async () => {
    signInAs("customer");
    const late = await askForTable({ startsAt: `${nextWeek}T22:00`, partySize: 2 });

    expect(late.status).toBe(400);
    expect((await readError(late)).fieldErrors).toEqual({ startsAt: "outsideBookingHours" });
    expect((await askForTable({ startsAt: `${nextWeek}T21:00`, partySize: 2 })).status).toBe(201);
  });

  it("holds staff bookings to the same hours", async () => {
    signInAs("staff");
    const early = await bookTable(
      jsonRequest("POST", "/api/admin/reservations", {
        guestName: "Sara Ahmadi",
        guestPhone: "09301184462",
        startsAt: `${nextWeek}T07:30`,
        partySize: 2,
      }),
    );

    expect(early.status).toBe(400);
    expect((await readError(early)).fieldErrors).toEqual({ startsAt: "outsideBookingHours" });
  });
});

describe("changing a booking's table", () => {
  it("takes only a table on the floor plan, as a new booking does", async () => {
    const booking = await confirmedAt(wallTimeToDate(`${nextWeek}T12:00`));
    signInAs("staff");

    const patio = await patchReservation(booking.id, { tableLabel: "Patio" });
    expect(patio.status).toBe(400);
    expect((await readError(patio)).fieldErrors).toEqual({ tableLabel: "tableInvalid" });

    const moved = await patchReservation(booking.id, { tableLabel: "5" });
    expect(moved.status).toBe(200);
    expect((await readJson<Reservation>(moved)).tableLabel).toBe("5");
  });
});

describe("before the guest is due", () => {
  it("refuses a table no-show before the booking starts (409 NOT_DUE_YET), not after", async () => {
    const ahead = await confirmedAt(wallTimeToDate(`${nextWeek}T12:00`));
    const started = await confirmedAt(new Date(Date.now() - 30 * 60_000));
    signInAs("staff");

    const early = await patchReservation(ahead.id, { status: "noShow" });
    expect(early.status).toBe(409);
    expect((await readError(early)).code).toBe("NOT_DUE_YET");

    const late = await patchReservation(started.id, { status: "noShow" });
    expect(late.status).toBe(200);
    expect((await readJson<Reservation>(late)).status).toBe("noShow");
  });

  it("refuses a suite check-in or no-show before the arrival day (409 NOT_DUE_YET)", async () => {
    const stay = await stayFrom(nextWeek);

    for (const status of ["checkedIn", "noShow"]) {
      const response = await patchStay(stay.id, { status });
      expect(response.status).toBe(409);
      expect((await readError(response)).code).toBe("NOT_DUE_YET");
    }
  });

  it("checks a guest in on their arrival day", async () => {
    const stay = await stayFrom(today);

    const response = await patchStay(stay.id, { status: "checkedIn" });
    expect(response.status).toBe(200);
    expect((await readJson<SuiteBooking>(response)).status).toBe("checkedIn");
  });
});
