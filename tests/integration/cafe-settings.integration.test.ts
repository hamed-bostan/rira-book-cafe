import { revalidateTag } from "next/cache";
import { describe, expect, it } from "vitest";

import { PUT as putEventTables } from "@/app/api/admin/events/[id]/tables/route";
import { GET as getFloor } from "@/app/api/admin/reservations/floor/route";
import { POST as bookTable } from "@/app/api/admin/reservations/route";
import { PUT as putHours } from "@/app/api/admin/settings/hours/route";
import { PUT as putProfile } from "@/app/api/admin/settings/profile/route";
import { PUT as putReceipt } from "@/app/api/admin/settings/receipt/route";
import { POST as moveTable } from "@/app/api/admin/tables/[id]/move/route";
import { DELETE as deleteTable, PUT as putTable } from "@/app/api/admin/tables/[id]/route";
import { GET as listTables, POST as addTable } from "@/app/api/admin/tables/route";
import { POST as createEvent } from "@/app/api/events/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import { GET as getSettings } from "@/app/api/settings/route";
import type { CafeEvent } from "@/src/domain/entities/CafeEvent";
import { WEEKDAYS, type CafeSettings } from "@/src/domain/entities/CafeSettings";
import type { CafeTable } from "@/src/domain/entities/CafeTable";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Floor } from "@/src/domain/entities/FloorAvailability";
import type { Reservation } from "@/src/domain/entities/Reservation";
import { prisma } from "@/src/infrastructure/prisma/client";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const nextWeek = shiftCafeDay(cafeDayOf(new Date()), 7);

/** The floor the migration copies in from the old constant, in floor order. */
const MIGRATED_FLOOR = [
  ["1", 2],
  ["2", 2],
  ["3", 4],
  ["4", 4],
  ["5", 4],
  ["6", 6],
  ["7", 6],
  ["8", 8],
  ["long", 12],
] as const;

const PROFILE = {
  name: "Rira Book Cafe",
  nameFa: "کافه کتاب ریرا",
  address: "12 Vali-e Asr St\nTehran",
  addressFa: "تهران، خیابان ولیعصر، پلاک ۱۲",
  phone: "021 1234 5678",
  instagram: "@rira.cafe",
  website: "https://rira.example",
  latitude: "35.6997",
  longitude: "51.338",
};

const WEEK = Object.fromEntries(
  WEEKDAYS.map((day) => [
    day,
    day === "Friday" ? { closed: true, opens: "", closes: "" } : { closed: false, opens: "08:00", closes: "22:00" },
  ]),
);

async function tables(): Promise<CafeTable[]> {
  signInAs("staff");
  return readJson<CafeTable[]>(await listTables());
}

async function tableId(label: string): Promise<string> {
  return (await prisma.cafeTable.findUniqueOrThrow({ where: { label } })).id;
}

function book(tableLabel: string, time = "18:30"): Promise<Response> {
  signInAs("staff");
  return bookTable(
    jsonRequest("POST", "/api/admin/reservations", {
      guestName: "Sara Ahmadi",
      guestPhone: "09301184462",
      startsAt: `${nextWeek}T${time}`,
      partySize: 2,
      note: "",
      tableLabel,
    }),
  );
}

function editTable(id: string, body: unknown): Promise<Response> {
  signInAs("admin");
  return putTable(jsonRequest("PUT", `/api/admin/tables/${id}`, body), routeParams({ id }));
}

function removeTable(id: string): Promise<Response> {
  signInAs("admin");
  return deleteTable(jsonRequest("DELETE", `/api/admin/tables/${id}`), routeParams({ id }));
}

async function workshopHolding(tableLabels: string[]): Promise<CafeEvent> {
  signInAs("admin");
  const created = await createEvent(
    jsonRequest("POST", "/api/events", {
      kind: "workshop",
      title: "Latte art workshop",
      description: "",
      titleFa: "",
      descriptionFa: "",
      imageUrl: "",
      startsAt: `${nextWeek}T10:00`,
      endsAt: `${nextWeek}T12:00`,
      capacity: "12",
      price: "0",
      isPublished: true,
    }),
  );
  const event = await readJson<CafeEvent>(created);
  const held = await putEventTables(
    jsonRequest("PUT", `/api/admin/events/${event.id}/tables`, { tableLabels }),
    routeParams({ id: event.id }),
  );
  expect(held.status).toBe(200);
  return readJson<CafeEvent>(held);
}

describe("the cafe's settings", () => {
  it("start empty, and are public to read", async () => {
    const response = await getSettings();
    expect(response.status).toBe(200);
    expect(await readJson<CafeSettings>(response)).toEqual({
      profile: {},
      hours: { weekly: null, exceptions: [] },
      receipt: {},
    });
  });

  it("are written by settings.write only", async () => {
    const body = jsonRequest("PUT", "/api/admin/settings/profile", PROFILE);
    expect((await putProfile(body)).status).toBe(401);
    signInAs("staff");
    expect((await putProfile(jsonRequest("PUT", "/api/admin/settings/profile", PROFILE))).status).toBe(401);
  });

  it("save the profile, expire the site's copy and log the change", async () => {
    signInAs("admin");
    const response = await putProfile(jsonRequest("PUT", "/api/admin/settings/profile", PROFILE));
    expect(response.status).toBe(200);
    const saved = await readJson<CafeSettings>(response);
    expect(saved.profile).toEqual({
      ...PROFILE,
      instagram: "rira.cafe",
      latitude: 35.6997,
      longitude: 51.338,
    });
    expect(revalidateTag).toHaveBeenCalledWith(CATALOG_TAGS.settings, { expire: 0 });
    expect((await readJson<CafeSettings>(await getSettings())).profile.nameFa).toBe("کافه کتاب ریرا");

    const entry = await prisma.activityEntry.findFirstOrThrow({ where: { action: "settings.profileChanged" } });
    expect(entry).toMatchObject({ entityType: "settings", entityId: "cafe" });
    expect(entry.changedFields).toEqual(expect.arrayContaining(["name", "phone", "latitude"]));
  });

  it("refuse a half map position with the field to fix", async () => {
    signInAs("admin");
    const response = await putProfile(jsonRequest("PUT", "/api/admin/settings/profile", { ...PROFILE, longitude: "" }));
    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toEqual({ longitude: "coordinatesBoth" });
  });

  it("save the opening hours and special days, Saturday first", async () => {
    signInAs("admin");
    const response = await putHours(
      jsonRequest("PUT", "/api/admin/settings/hours", {
        weekly: WEEK,
        exceptions: [{ date: "2027-03-21", closed: true, opens: "", closes: "", note: "Nowruz", noteFa: "نوروز" }],
      }),
    );
    expect(response.status).toBe(200);
    const { hours } = await readJson<CafeSettings>(response);
    expect(hours.weekly?.Friday).toEqual({ closed: true });
    expect(hours.weekly?.Saturday).toEqual({ closed: false, opens: "08:00", closes: "22:00" });
    expect(hours.exceptions).toEqual([{ date: "2027-03-21", closed: true, note: "Nowruz", noteFa: "نوروز" }]);
    expect(await prisma.activityEntry.count({ where: { action: "settings.hoursChanged" } })).toBe(1);
  });

  it("save the receipt's header and closing note", async () => {
    signInAs("admin");
    const response = await putReceipt(
      jsonRequest("PUT", "/api/admin/settings/receipt", {
        header: "Coffee · Books",
        headerFa: "قهوه · کتاب",
        footer: "Thank you!",
        footerFa: "",
      }),
    );
    expect(response.status).toBe(200);
    expect((await readJson<CafeSettings>(response)).receipt).toEqual({
      header: "Coffee · Books",
      headerFa: "قهوه · کتاب",
      footer: "Thank you!",
    });
  });
});

describe("the floor's tables", () => {
  it("are the migrated floor on day one, read by anyone with the dashboard", async () => {
    expect((await listTables()).status).toBe(401);
    const floor = await tables();
    expect(floor.map((table) => [table.label, table.seats])).toEqual(MIGRATED_FLOOR);
    expect(floor.every((table) => table.isActive)).toBe(true);
  });

  it("are added at the end by settings.write, with a label no other table has", async () => {
    signInAs("staff");
    const body = { label: "Bar", seats: "3", area: "Counter", isActive: true };
    expect((await addTable(jsonRequest("POST", "/api/admin/tables", body))).status).toBe(401);

    signInAs("admin");
    const created = await addTable(jsonRequest("POST", "/api/admin/tables", body));
    expect(created.status).toBe(201);
    expect(await readJson<CafeTable>(created)).toMatchObject({ label: "Bar", seats: 3, area: "Counter", position: 9 });

    const duplicate = await addTable(jsonRequest("POST", "/api/admin/tables", { ...body, label: "7" }));
    expect(duplicate.status).toBe(409);
    expect((await readError(duplicate)).fieldErrors).toEqual({ label: "alreadyTaken" });

    expect(await prisma.activityEntry.count({ where: { action: "settings.tableAdded" } })).toBe(1);
  });

  it("feed the floor pickers and booking checks: a new table can be booked, one out of use can't", async () => {
    signInAs("admin");
    await addTable(jsonRequest("POST", "/api/admin/tables", { label: "Bar", seats: "3", area: "", isActive: true }));
    expect((await book("Bar")).status).toBe(201);

    const seven = await tableId("7");
    expect((await editTable(seven, { label: "7", seats: "6", area: "", isActive: false })).status).toBe(200);
    const refused = await book("7", "20:00");
    expect(refused.status).toBe(400);
    expect((await readError(refused)).fieldErrors).toHaveProperty("tableLabel");

    signInAs("staff");
    const floor = await readJson<Floor>(await getFloor(getRequest(`/api/admin/reservations/floor?day=${nextWeek}`)));
    expect(floor.tables.map((table) => table.label)).toEqual(["1", "2", "3", "4", "5", "6", "8", "long", "Bar"]);
  });

  it("carry a new label onto their bookings and event holds", async () => {
    const booked = await readJson<Reservation>(await book("6"));
    const event = await workshopHolding(["6", "8"]);

    const response = await editTable(await tableId("6"), { label: "Window", seats: "6", area: "", isActive: true });
    expect(response.status).toBe(200);

    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: booked.id } })).tableLabel).toBe("Window");
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).tableLabels).toEqual(["Window", "8"]);
    const entry = await prisma.activityEntry.findFirstOrThrow({ where: { action: "settings.tableChanged" } });
    expect(entry.changes).toEqual([{ field: "label", before: "6", after: "Window" }]);
  });

  it("move along the floor order", async () => {
    signInAs("admin");
    const long = await tableId("long");
    const response = await moveTable(
      jsonRequest("POST", `/api/admin/tables/${long}/move`, { direction: "up" }),
      routeParams({ id: long }),
    );
    expect(response.status).toBe(204);
    expect((await tables()).map((table) => table.label).slice(-2)).toEqual(["long", "8"]);

    const eight = await tableId("8");
    signInAs("admin");
    const last = await moveTable(
      jsonRequest("POST", `/api/admin/tables/${eight}/move`, { direction: "down" }),
      routeParams({ id: eight }),
    );
    expect(last.status).toBe(400);
  });

  it("can't be deleted while a booking or event holds them ahead, or an order is open at them", async () => {
    expect((await book("3")).status).toBe(201);
    const booked = await removeTable(await tableId("3"));
    expect(booked.status).toBe(409);
    expect((await readError(booked)).code).toBe("IN_USE");

    await workshopHolding(["5"]);
    expect((await removeTable(await tableId("5"))).status).toBe(409);

    signInAs("customer");
    const order = await placeOrder(
      jsonRequest("POST", "/api/orders", {
        items: [{ productId: "seed-espresso", quantity: 1 }],
        serviceType: "dineIn",
        tableLabel: "2",
      }),
    );
    expect(order.status).toBe(201);
    expect((await removeTable(await tableId("2"))).status).toBe(409);
    expect(await prisma.cafeTable.count()).toBe(MIGRATED_FLOOR.length);
  });

  it("are deleted when nothing still needs them, and the delete is logged", async () => {
    const response = await removeTable(await tableId("1"));
    expect(response.status).toBe(204);
    expect(await prisma.cafeTable.findUnique({ where: { label: "1" } })).toBeNull();
    const entry = await prisma.activityEntry.findFirstOrThrow({ where: { action: "settings.tableRemoved" } });
    expect(entry.entityLabel).toBe("1");
    expect((await removeTable("missing")).status).toBe(404);
  });
});
