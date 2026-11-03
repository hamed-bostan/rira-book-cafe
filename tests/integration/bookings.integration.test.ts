import { describe, expect, it } from "vitest";

import { GET as listReservations, POST as bookTable } from "@/app/api/admin/reservations/route";
import { POST as requestTable } from "@/app/api/reservations/route";
import { cafeDayOf, shiftCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import type { Reservation } from "@/src/domain/entities/Reservation";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const nextWeek = shiftCafeDay(today, 7);

function askForTable(body: unknown): Promise<Response> {
  return requestTable(jsonRequest("POST", "/api/reservations", body));
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
