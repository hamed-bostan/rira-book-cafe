import { describe, expect, it } from "vitest";

import { PUT as putTables } from "@/app/api/admin/events/[id]/tables/route";
import { POST as bookTable } from "@/app/api/admin/reservations/route";
import { POST as bookSuite } from "@/app/api/admin/suite-bookings/route";
import { POST as createEvent } from "@/app/api/events/route";
import type { CafeEvent } from "@/src/domain/entities/CafeEvent";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Reservation } from "@/src/domain/entities/Reservation";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";

import { jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const nextWeek = shiftCafeDay(cafeDayOf(new Date()), 7);

const walkIn = {
  guestName: "Sara Ahmadi",
  guestPhone: "09301184462",
  startsAt: `${nextWeek}T18:30`,
  partySize: 2,
  note: "",
};

function postTable(body: unknown): Promise<Response> {
  return bookTable(jsonRequest("POST", "/api/admin/reservations", body));
}

function postSuite(body: unknown): Promise<Response> {
  return bookSuite(jsonRequest("POST", "/api/admin/suite-bookings", body));
}

describe("staff table bookings", () => {
  it("only lets reservation managers book for a guest", async () => {
    expect((await postTable(walkIn)).status).toBe(401);
    signInAs("customer");
    expect((await postTable(walkIn)).status).toBe(401);
  });

  it("saves a request without a table, and a confirmed booking with one", async () => {
    signInAs("staff");
    const request = await postTable(walkIn);
    expect(request.status).toBe(201);
    const saved = await readJson<Reservation>(request);
    expect(saved).toMatchObject({ status: "requested", guestName: "Sara Ahmadi" });
    expect(saved).not.toHaveProperty("userId");

    const confirmed = await postTable({ ...walkIn, startsAt: `${nextWeek}T12:00`, tableLabel: "3" });
    expect(confirmed.status).toBe(201);
    expect(await readJson<Reservation>(confirmed)).toMatchObject({ status: "confirmed", tableLabel: "3" });
  });

  it("refuses a table already booked, or held by an event, at that time", async () => {
    signInAs("staff");
    expect((await postTable({ ...walkIn, startsAt: `${nextWeek}T10:00`, tableLabel: "4" })).status).toBe(201);
    const taken = await postTable({ ...walkIn, startsAt: `${nextWeek}T10:30`, tableLabel: "4" });
    expect(taken.status).toBe(409);
    expect((await readError(taken)).code).toBe("TABLE_TAKEN");

    signInAs("admin");
    const created = await createEvent(
      jsonRequest("POST", "/api/events", {
        kind: "workshop",
        title: "Latte art workshop",
        description: "",
        titleFa: "",
        descriptionFa: "",
        imageUrl: "",
        startsAt: `${nextWeek}T17:00`,
        endsAt: `${nextWeek}T19:00`,
        capacity: "12",
        price: "0",
        isPublished: true,
      }),
    );
    const event = await readJson<CafeEvent>(created);
    await putTables(
      jsonRequest("PUT", `/api/admin/events/${event.id}/tables`, { tableLabels: ["7"] }),
      routeParams({ id: event.id }),
    );

    const held = await postTable({ ...walkIn, tableLabel: "7" });
    expect(held.status).toBe(409);
    expect((await readError(held)).code).toBe("TABLE_HELD");
  });

  it("validates the guest's details and the table with 400", async () => {
    signInAs("staff");
    const response = await postTable({ ...walkIn, guestName: " ", guestPhone: "12", tableLabel: "Patio" });
    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({
      guestName: "nameRequired",
      guestPhone: "phoneInvalid",
      tableLabel: "tableInvalid",
    });
  });
});

describe("staff suite bookings", () => {
  const stay = {
    guestName: "Omid Karimi",
    guestPhone: "09356401182",
    checkIn: shiftCafeDay(nextWeek, 30),
    checkOut: shiftCafeDay(nextWeek, 32),
    guests: 2,
    note: "",
  };

  it("confirms the stay straight away, with no guest account", async () => {
    signInAs("staff");
    const response = await postSuite(stay);
    expect(response.status).toBe(201);
    const saved = await readJson<SuiteBooking>(response);
    expect(saved.status).toBe("confirmed");
    expect(saved).not.toHaveProperty("userId");
  });

  it("refuses nights another stay holds (409 SUITE_TAKEN)", async () => {
    signInAs("staff");
    expect(
      (await postSuite({ ...stay, checkIn: shiftCafeDay(nextWeek, 40), checkOut: shiftCafeDay(nextWeek, 43) })).status,
    ).toBe(201);
    const clash = await postSuite({
      ...stay,
      checkIn: shiftCafeDay(nextWeek, 42),
      checkOut: shiftCafeDay(nextWeek, 44),
    });
    expect(clash.status).toBe(409);
    expect((await readError(clash)).code).toBe("SUITE_TAKEN");
  });

  it("validates with 400 and per-field errors", async () => {
    signInAs("staff");
    const response = await postSuite({ ...stay, guestPhone: "x", checkOut: stay.checkIn });
    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({
      guestPhone: "phoneInvalid",
      checkOut: "checkOutBeforeCheckIn",
    });
  });

  it("only lets reservation managers book", async () => {
    signInAs("customer");
    expect((await postSuite(stay)).status).toBe(401);
  });
});
