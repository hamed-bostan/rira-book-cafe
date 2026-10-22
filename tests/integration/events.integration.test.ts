import { describe, expect, it } from "vitest";

import { GET as getTables, PUT as putTables } from "@/app/api/admin/events/[id]/tables/route";
import { PATCH as changeReservation } from "@/app/api/admin/reservations/[id]/route";
import { POST as register } from "@/app/api/events/[id]/registrations/route";
import { DELETE as deleteEvent, GET as getEvent, PUT as updateEvent } from "@/app/api/events/[id]/route";
import { GET as listEvents, POST as createEvent } from "@/app/api/events/route";
import type { CafeEvent, EventTableOption } from "@/src/domain/entities/CafeEvent";
import { CAFE_TABLE_LABELS } from "@/src/domain/entities/CafeTable";
import { cafeDayOf, shiftCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const nextWeek = shiftCafeDay(cafeDayOf(new Date()), 7);

const workshop = {
  kind: "workshop",
  title: "Latte art workshop",
  description: "Pour a rosetta by the end of the evening.",
  titleFa: "",
  descriptionFa: "",
  imageUrl: "",
  startsAt: `${nextWeek}T17:00`,
  endsAt: `${nextWeek}T19:00`,
  capacity: "2",
  price: "250000",
  isPublished: true,
};

async function createAsAdmin(body: unknown = workshop): Promise<CafeEvent> {
  signInAs("admin");
  const response = await createEvent(jsonRequest("POST", "/api/events", body));
  expect(response.status).toBe(201);
  return readJson<CafeEvent>(response);
}

async function registerAs(user: "customer" | "staff" | "owner", eventId: string, seats: number): Promise<Response> {
  signInAs(user);
  return register(jsonRequest("POST", `/api/events/${eventId}/registrations`, { seats }), routeParams({ id: eventId }));
}

describe("events", () => {
  it("lists the upcoming published events publicly", async () => {
    const response = await listEvents();

    expect(response.status).toBe(200);
    const ids = (await readJson<CafeEvent[]>(response)).map((event) => event.id);
    expect(ids).toEqual(expect.arrayContaining(["seed-event-book-club", "seed-event-reading"]));
  });

  it("only lets event managers create one", async () => {
    expect((await createEvent(jsonRequest("POST", "/api/events", workshop))).status).toBe(401);

    signInAs("staff");
    expect((await createEvent(jsonRequest("POST", "/api/events", workshop))).status).toBe(401);
  });

  it("validates the form with 400 and per-field errors", async () => {
    signInAs("admin");
    const response = await createEvent(
      jsonRequest("POST", "/api/events", { ...workshop, title: "", endsAt: `${nextWeek}T16:00`, capacity: "0" }),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({
      title: "titleRequired",
      endsAt: "endBeforeStart",
      capacity: "capacityMin",
    });
  });

  it("creates, updates and deletes an event", async () => {
    const event = await createAsAdmin();
    expect(event).toMatchObject({ title: "Latte art workshop", capacity: 2, price: 250000, seatsTaken: 0 });

    const read = await getEvent(getRequest(`/api/events/${event.id}`), routeParams({ id: event.id }));
    expect(read.status).toBe(200);

    const updated = await updateEvent(
      jsonRequest("PUT", `/api/events/${event.id}`, { ...workshop, title: "Latte art, round two" }),
      routeParams({ id: event.id }),
    );
    expect(updated.status).toBe(200);
    expect((await readJson<CafeEvent>(updated)).title).toBe("Latte art, round two");

    const deleted = await deleteEvent(jsonRequest("DELETE", `/api/events/${event.id}`), routeParams({ id: event.id }));
    expect(deleted.status).toBe(204);
    expect((await getEvent(getRequest(`/api/events/${event.id}`), routeParams({ id: event.id }))).status).toBe(404);
  });

  it("answers 404 for an unknown event", async () => {
    signInAs("admin");
    const id = "00000000-0000-0000-0000-000000000000";

    expect((await getEvent(getRequest(`/api/events/${id}`), routeParams({ id }))).status).toBe(404);
    expect((await updateEvent(jsonRequest("PUT", `/api/events/${id}`, workshop), routeParams({ id }))).status).toBe(
      404,
    );
  });
});

describe("event registration", () => {
  it("needs a signed-in guest", async () => {
    const response = await register(
      jsonRequest("POST", "/api/events/seed-event-book-club/registrations", { seats: 1 }),
      routeParams({ id: "seed-event-book-club" }),
    );

    expect(response.status).toBe(401);
  });

  it("validates the seat count with 400", async () => {
    const response = await registerAs("customer", "seed-event-book-club", 0);

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ seats: "seatsInvalid" });
  });

  it("registers a guest once, and refuses seats past capacity (409)", async () => {
    const event = await createAsAdmin();

    const first = await registerAs("customer", event.id, 1);
    expect(first.status).toBe(201);

    const again = await registerAs("customer", event.id, 1);
    expect(again.status).toBe(409);
    expect((await readError(again)).code).toBe("ALREADY_REGISTERED");

    const tooMany = await registerAs("staff", event.id, 2);
    expect(tooMany.status).toBe(409);
    expect((await readError(tooMany)).code).toBe("EVENT_FULL");

    expect(await prisma.eventRegistration.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("refuses sign-ups for an unpublished event", async () => {
    const event = await createAsAdmin({ ...workshop, isPublished: false });

    const response = await registerAs("customer", event.id, 1);

    expect([404, 409]).toContain(response.status);
    expect(await prisma.eventRegistration.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("won't shrink capacity below the seats already taken (400)", async () => {
    const event = await createAsAdmin();
    expect((await registerAs("customer", event.id, 2)).status).toBe(201);

    signInAs("admin");
    const response = await updateEvent(
      jsonRequest("PUT", `/api/events/${event.id}`, { ...workshop, capacity: "1" }),
      routeParams({ id: event.id }),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toHaveProperty("capacity");
  });
});

describe("event table holds", () => {
  /** A confirmed booking at `table` from `time` on the workshop's day, as the floor would hold it. */
  async function bookTable(table: string, time: string): Promise<{ id: string; reference: number }> {
    return prisma.reservation.create({
      data: {
        userId: TEST_USERS.customer.id,
        guestName: "Sara",
        guestPhone: "09120000000",
        partySize: 4,
        startsAt: wallTimeToDate(`${nextWeek}T${time}`),
        durationMinutes: 90,
        status: "confirmed",
        tableLabel: table,
      },
      select: { id: true, reference: true },
    });
  }

  function holdTables(eventId: string, tableLabels: string[]): Promise<Response> {
    return putTables(
      jsonRequest("PUT", `/api/admin/events/${eventId}/tables`, { tableLabels }),
      routeParams({ id: eventId }),
    );
  }

  it("lists the floor with what already has each table", async () => {
    const event = await createAsAdmin();
    const booking = await bookTable("6", "17:30");

    const response = await getTables(getRequest(`/api/admin/events/${event.id}/tables`), routeParams({ id: event.id }));

    expect(response.status).toBe(200);
    const options = await readJson<EventTableOption[]>(response);
    expect(options.map((option) => option.label)).toEqual(CAFE_TABLE_LABELS);
    expect(options.find((option) => option.label === "6")?.clash).toMatchObject({
      kind: "booking",
      reference: booking.reference,
    });
    expect(options.find((option) => option.label === "7")).toEqual({ label: "7", seats: 6, held: false });
  });

  it("holds free tables in floor order, and only for event managers", async () => {
    const event = await createAsAdmin();

    signInAs("staff");
    expect((await holdTables(event.id, ["7"])).status).toBe(401);

    signInAs("admin");
    const response = await holdTables(event.id, ["8", "7"]);
    expect(response.status).toBe(200);
    expect((await readJson<CafeEvent>(response)).tableLabels).toEqual(["7", "8"]);
  });

  it("refuses a table a guest booked then, or one off the floor plan", async () => {
    const event = await createAsAdmin();
    await bookTable("6", "18:30");

    signInAs("admin");
    const taken = await holdTables(event.id, ["6", "7"]);
    expect(taken.status).toBe(409);
    expect((await readError(taken)).code).toBe("TABLE_TAKEN");

    const unknown = await holdTables(event.id, ["Table 7"]);
    expect(unknown.status).toBe(400);
    expect((await readError(unknown)).fieldErrors).toMatchObject({ tableLabels: "tableInvalid" });
  });

  it("refuses a table another event holds at the same time", async () => {
    const first = await createAsAdmin();
    const second = await createAsAdmin({ ...workshop, title: "Book club", startsAt: `${nextWeek}T18:00` });

    signInAs("admin");
    expect((await holdTables(first.id, ["7"])).status).toBe(200);
    const clash = await holdTables(second.id, ["7"]);
    expect(clash.status).toBe(409);
    expect((await readError(clash)).code).toBe("TABLE_TAKEN");
  });

  it("stops a booking from taking a held table (409 TABLE_HELD)", async () => {
    const event = await createAsAdmin();
    signInAs("admin");
    expect((await holdTables(event.id, ["7"])).status).toBe(200);
    const booking = await prisma.reservation.create({
      data: {
        userId: TEST_USERS.customer.id,
        guestName: "Sara",
        guestPhone: "09120000000",
        partySize: 2,
        startsAt: wallTimeToDate(`${nextWeek}T18:00`),
        durationMinutes: 90,
      },
    });

    const response = await changeReservation(
      jsonRequest("PATCH", `/api/admin/reservations/${booking.id}`, { status: "confirmed", tableLabel: "7" }),
      routeParams({ id: booking.id }),
    );

    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("TABLE_HELD");
  });

  it("releases held tables that clash at an event's new time", async () => {
    const event = await createAsAdmin();
    signInAs("admin");
    expect((await holdTables(event.id, ["7", "8"])).status).toBe(200);
    await bookTable("8", "20:30");

    const response = await updateEvent(
      jsonRequest("PUT", `/api/events/${event.id}`, {
        ...workshop,
        startsAt: `${nextWeek}T20:00`,
        endsAt: `${nextWeek}T22:00`,
      }),
      routeParams({ id: event.id }),
    );

    expect(response.status).toBe(200);
    expect((await readJson<CafeEvent>(response)).tableLabels).toEqual(["7"]);
  });
});
