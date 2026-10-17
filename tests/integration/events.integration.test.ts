import { describe, expect, it } from "vitest";

import { POST as register } from "@/app/api/events/[id]/registrations/route";
import { DELETE as deleteEvent, GET as getEvent, PUT as updateEvent } from "@/app/api/events/[id]/route";
import { GET as listEvents, POST as createEvent } from "@/app/api/events/route";
import type { CafeEvent } from "@/src/domain/entities/CafeEvent";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { prisma } from "@/src/infrastructure/prisma/client";

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
    expect((await updateEvent(jsonRequest("PUT", `/api/events/${id}`, workshop), routeParams({ id }))).status).toBe(404);
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
