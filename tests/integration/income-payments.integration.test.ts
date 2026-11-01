import { describe, expect, it } from "vitest";

import { GET as listRegistrations } from "@/app/api/admin/events/[id]/registrations/route";
import { POST as voidIncome } from "@/app/api/admin/income/[id]/void/route";
import { POST as recordIncome } from "@/app/api/admin/income/route";
import { GET as listStays } from "@/app/api/admin/suite-bookings/route";
import type { EventRegistration } from "@/src/domain/entities/CafeEvent";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Income } from "@/src/domain/entities/Income";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const EVENT = "seed-event-book-club";

/** Take payment the way the button on a guest list or a stay does. */
async function takePayment(body: Record<string, unknown>): Promise<Income> {
  signInAs("admin");
  const response = await recordIncome(
    jsonRequest("POST", "/api/admin/income", {
      date: today,
      vatAmount: "",
      method: "cash",
      payerName: "Sara",
      ...body,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Income>(response);
}

async function guestList(): Promise<EventRegistration[]> {
  const response = await listRegistrations(
    getRequest(`/api/admin/events/${EVENT}/registrations`),
    routeParams({ id: EVENT }),
  );
  return readJson<EventRegistration[]>(response);
}

describe("taking payment for a booking", () => {
  it("shows what an event guest has paid, books the tickets, and clears when voided", async () => {
    const registration = await prisma.eventRegistration.create({
      data: { eventId: EVENT, userId: "09120000004", guestName: "Test Guest", guestPhone: "09120000004", seats: 2 },
    });

    const income = await takePayment({
      accountCode: "4400",
      description: "Book club × 2",
      amount: "300000",
      sourceType: "eventRegistration",
      sourceId: registration.id,
    });

    expect((await guestList()).find((row) => row.id === registration.id)?.paidAmount).toBe(300000);
    const tickets = await prisma.journalLine.aggregate({ where: { accountCode: "4400" }, _sum: { credit: true } });
    expect(Number(tickets._sum.credit)).toBe(300000);

    await voidIncome(
      jsonRequest("POST", `/api/admin/income/${income.id}/void`, { reason: "Handed back" }),
      routeParams({ id: income.id }),
    );
    expect((await guestList()).find((row) => row.id === registration.id)?.paidAmount).toBe(0);
  });

  it("adds up a deposit and the balance on a suite stay", async () => {
    const stay = await prisma.suiteBooking.create({
      data: {
        guestName: "Sara",
        guestPhone: "09121234567",
        guests: 2,
        checkIn: new Date(`${today}T00:00:00.000Z`),
        checkOut: new Date(`${shiftCafeDay(today, 2)}T00:00:00.000Z`),
        status: "confirmed",
      },
    });
    const payment = {
      accountCode: "4500",
      description: "Suite stay",
      sourceType: "suiteBooking",
      sourceId: stay.id,
    };

    await takePayment({ ...payment, amount: "1000000" });
    await takePayment({ ...payment, amount: "2000000" });

    const response = await listStays(getRequest(`/api/admin/suite-bookings?from=${today}`));
    const stays = await readJson<SuiteBooking[]>(response);
    expect(stays.find((row) => row.id === stay.id)?.paidAmount).toBe(3000000);
  });
});
