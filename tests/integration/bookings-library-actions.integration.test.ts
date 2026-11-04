import { describe, expect, it } from "vitest";

import { PATCH as changeLoan } from "@/app/api/admin/book-loans/[id]/route";
import { POST as lend } from "@/app/api/admin/book-loans/route";
import { GET as getEvent } from "@/app/api/admin/events/[id]/route";
import { GET as listEvents } from "@/app/api/admin/events/route";
import { POST as sendMessage } from "@/app/api/admin/guest-messages/route";
import { PATCH as changeReservation } from "@/app/api/admin/reservations/[id]/route";
import { POST as bookTable } from "@/app/api/admin/reservations/route";
import { PATCH as changeStay } from "@/app/api/admin/suite-bookings/[id]/route";
import { POST as bookSuite } from "@/app/api/admin/suite-bookings/route";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { CafeEvent } from "@/src/domain/entities/CafeEvent";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Reservation } from "@/src/domain/entities/Reservation";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * The Bookings and Library actions no other suite drives through their routes:
 * a table booking's Complete and its toasts' undos, a new table; a stay's
 * check-out and the undo of its check-in; a loan extension taken back; staff
 * writing to a stay's or a loan's guest; and the events list the dashboard reads.
 */

const today = cafeDayOf(new Date());
const nextWeek = shiftCafeDay(today, 7);
const BLIND_OWL = "seed-book-blind-owl";
const BOOK_CLUB = "seed-event-book-club";
const GUEST = { name: "Leila Moradi", phone: "0935 220 7714", id: "09352207714" };

async function booking(): Promise<Reservation> {
  signInAs("staff");
  const response = await bookTable(
    jsonRequest("POST", "/api/admin/reservations", {
      guestName: GUEST.name,
      guestPhone: GUEST.phone,
      startsAt: `${nextWeek}T18:30`,
      partySize: 2,
      note: "",
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Reservation>(response);
}

function patchBooking(id: string, body: unknown): Promise<Response> {
  return changeReservation(jsonRequest("PATCH", `/api/admin/reservations/${id}`, body), routeParams({ id }));
}

async function stay(checkIn: string): Promise<SuiteBooking> {
  signInAs("staff");
  const response = await bookSuite(
    jsonRequest("POST", "/api/admin/suite-bookings", {
      guestName: GUEST.name,
      guestPhone: GUEST.phone,
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

async function loan(): Promise<BookLoan> {
  signInAs("staff");
  const response = await lend(
    jsonRequest("POST", "/api/admin/book-loans", {
      productId: BLIND_OWL,
      borrowerName: GUEST.name,
      borrowerPhone: GUEST.phone,
      dueOn: shiftCafeDay(today, 14),
      note: "",
    }),
  );
  expect(response.status).toBe(201);
  return readJson<BookLoan>(response);
}

function patchLoan(id: string, body: unknown): Promise<Response> {
  return changeLoan(jsonRequest("PATCH", `/api/admin/book-loans/${id}`, body), routeParams({ id }));
}

function message(body: unknown): Promise<Response> {
  return sendMessage(jsonRequest("POST", "/api/admin/guest-messages", body));
}

describe("a table booking", () => {
  it("is seated and completed, and each step can be taken back from its toast", async () => {
    const { id } = await booking();
    expect((await patchBooking(id, { status: "confirmed", tableLabel: "3" })).status).toBe(200);
    expect((await patchBooking(id, { status: "seated" })).status).toBe(200);

    const completed = await patchBooking(id, { status: "completed" });
    expect(completed.status).toBe(200);
    expect(await readJson<Reservation>(completed)).toMatchObject({ status: "completed", tableLabel: "3" });

    const backToSeated = await patchBooking(id, { status: "seated", undo: true });
    expect(backToSeated.status).toBe(200);
    expect((await readJson<Reservation>(backToSeated)).status).toBe("seated");
    const backToConfirmed = await patchBooking(id, { status: "confirmed", undo: true });
    expect((await readJson<Reservation>(backToConfirmed)).status).toBe("confirmed");

    // An undo only takes back a Seat or a Complete — not a Confirm.
    const tooFar = await patchBooking(id, { status: "requested", undo: true });
    expect(tooFar.status).toBe(409);
    expect((await readError(tooFar)).code).toBe("INVALID_TRANSITION");
  });

  it("moves to another table on the floor, keeping its status", async () => {
    const { id } = await booking();
    await patchBooking(id, { status: "confirmed", tableLabel: "3" });

    const moved = await patchBooking(id, { tableLabel: "5" });

    expect(moved.status).toBe(200);
    expect(await readJson<Reservation>(moved)).toMatchObject({ status: "confirmed", tableLabel: "5" });
  });
});

describe("a suite stay", () => {
  it("checks in, takes the check-in back, then checks in and out", async () => {
    const { id } = await stay(today);
    expect((await patchStay(id, { status: "checkedIn" })).status).toBe(200);

    const undone = await patchStay(id, { status: "confirmed", undo: true });
    expect(undone.status).toBe(200);
    expect((await readJson<SuiteBooking>(undone)).status).toBe("confirmed");

    expect((await patchStay(id, { status: "checkedIn" })).status).toBe(200);
    const out = await patchStay(id, { status: "checkedOut" });
    expect(out.status).toBe(200);
    expect((await readJson<SuiteBooking>(out)).status).toBe("checkedOut");

    // A check-out can't be taken back.
    expect((await patchStay(id, { status: "checkedIn", undo: true })).status).toBe(409);
  });

  it("won't check out a guest who never checked in", async () => {
    const { id } = await stay(today);

    const out = await patchStay(id, { status: "checkedOut" });

    expect(out.status).toBe(409);
    expect((await readError(out)).code).toBe("INVALID_TRANSITION");
  });
});

describe("a book loan", () => {
  it("is extended a week, and the extension taken back restores the due time", async () => {
    const lent = await loan();

    const extended = await patchLoan(lent.id, { extendDays: 7 });
    expect(extended.status).toBe(200);
    const longer = await readJson<BookLoan>(extended);
    expect(new Date(longer.dueAt).getTime() - new Date(lent.dueAt).getTime()).toBe(7 * 24 * 60 * 60 * 1000);

    const undone = await patchLoan(lent.id, { undoExtend: { dueAt: lent.dueAt, extendedDueAt: longer.dueAt } });
    expect(undone.status).toBe(200);
    expect((await readJson<BookLoan>(undone)).dueAt).toBe(lent.dueAt);

    // Taken back once: a second undo no longer matches the due time, so it's refused.
    expect((await patchLoan(lent.id, { undoExtend: { dueAt: lent.dueAt, extendedDueAt: longer.dueAt } })).status).toBe(
      409,
    );
  });
});

describe("staff writing to a guest", () => {
  it("reaches a stay's guest and a borrower, on the profile their phone found", async () => {
    const booked = await stay(nextWeek);
    const lent = await loan();
    signInAs("staff");

    const aboutStay = await message({
      phone: GUEST.phone,
      text: "The suite is ready from 2pm.",
      about: { kind: "suiteBooking", id: booked.id },
    });
    const aboutLoan = await message({
      phone: GUEST.phone,
      text: "Keep it another week if you like.",
      about: { kind: "bookLoan", id: lent.id },
    });

    expect(aboutStay.status).toBe(201);
    expect(aboutLoan.status).toBe(201);
    const notes = await prisma.notification.findMany({
      where: { userId: GUEST.id, kind: "staffMessage" },
      orderBy: { createdAt: "asc" },
    });
    expect(notes.map((note) => (note.params as { about: string }).about)).toEqual(["suiteBooking", "bookLoan"]);
  });

  it("refuses a phone that isn't the guest's on the stay (409)", async () => {
    const booked = await stay(nextWeek);
    signInAs("staff");

    const wrong = await message({
      phone: "0935 000 0000",
      text: "Hello",
      about: { kind: "suiteBooking", id: booked.id },
    });

    expect(wrong.status).toBe(409);
    expect((await readError(wrong)).code).toBe("GUEST_CHANGED");
  });
});

describe("the events the dashboard lists", () => {
  it("lists every event to the dashboard, and reads one", async () => {
    signInAs("staff");

    const events = await readJson<CafeEvent[]>(await listEvents());
    expect(events.map((event) => event.id)).toContain(BOOK_CLUB);

    const one = await getEvent(getRequest(`/api/admin/events/${BOOK_CLUB}`), routeParams({ id: BOOK_CLUB }));
    expect(one.status).toBe(200);
    expect((await readJson<CafeEvent>(one)).id).toBe(BOOK_CLUB);
    expect((await getEvent(getRequest("/api/admin/events/nope"), routeParams({ id: "nope" }))).status).toBe(404);
  });

  it("keeps guests out (401)", async () => {
    signInAs("customer");

    expect((await listEvents()).status).toBe(401);
  });
});
