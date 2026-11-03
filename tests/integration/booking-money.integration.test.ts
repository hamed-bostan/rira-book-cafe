import { describe, expect, it } from "vitest";

import { POST as refundRegistration } from "@/app/api/admin/events/[id]/registrations/[registrationId]/refunds/route";
import { GET as listRegistrations } from "@/app/api/admin/events/[id]/registrations/route";
import { POST as voidIncome } from "@/app/api/admin/income/[id]/void/route";
import { POST as recordIncome } from "@/app/api/admin/income/route";
import { PATCH as settleDeposit, POST as takeDeposit } from "@/app/api/admin/reservations/[id]/deposit/route";
import { PUT as setStayRate } from "@/app/api/admin/suite-bookings/[id]/rate/route";
import { POST as refundStay } from "@/app/api/admin/suite-bookings/[id]/refunds/route";
import { PATCH as changeStay } from "@/app/api/admin/suite-bookings/[id]/route";
import { POST as bookStay, GET as listStays } from "@/app/api/admin/suite-bookings/route";
import { GET as readSuitePrice, PUT as setSuitePrice } from "@/app/api/admin/suite-bookings/settings/route";
import type { EventRegistration } from "@/src/domain/entities/CafeEvent";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Income } from "@/src/domain/entities/Income";
import type { IncomeRefund } from "@/src/domain/entities/IncomeRefund";
import type { Reservation } from "@/src/domain/entities/Reservation";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { suiteStayMoney, type SuiteSettings } from "@/src/domain/entities/SuitePricing";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS, type TestUserKey } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const EVENT = "seed-event-book-club";

/** Each account's balance (debits less credits) from the journal, as the trial balance reads it. */
async function balance(accountCode: string): Promise<number> {
  const sums = await prisma.journalLine.aggregate({ where: { accountCode }, _sum: { debit: true, credit: true } });
  return Number(sums._sum.debit ?? 0) - Number(sums._sum.credit ?? 0);
}

/** The journal as a whole still balances: every debit has its credit. */
async function expectBooksBalance(): Promise<void> {
  const sums = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  expect(Number(sums._sum.debit)).toBe(Number(sums._sum.credit));
}

async function aReservation(status: string): Promise<string> {
  const row = await prisma.reservation.create({
    data: {
      guestName: "Neda",
      guestPhone: "09125550000",
      partySize: 8,
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      durationMinutes: 90,
      status,
      tableLabel: status === "requested" ? null : "T1",
    },
  });
  return row.id;
}

function deposit(as: TestUserKey | null, id: string, body: unknown, method: "POST" | "PATCH" = "POST") {
  signInAs(as);
  const request = jsonRequest(method, `/api/admin/reservations/${id}/deposit`, body);
  return method === "POST" ? takeDeposit(request, routeParams({ id })) : settleDeposit(request, routeParams({ id }));
}

async function aStay(guestPhone = "+98 912 777 0000"): Promise<SuiteBooking> {
  signInAs("staff");
  const response = await bookStay(
    jsonRequest("POST", "/api/admin/suite-bookings", {
      checkIn: shiftCafeDay(today, 3),
      checkOut: shiftCafeDay(today, 5),
      guests: 2,
      guestName: "Kian",
      guestPhone,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<SuiteBooking>(response);
}

async function pay(sourceType: string, sourceId: string, amount: number, vatAmount: number, method = "cash") {
  signInAs("admin");
  const response = await recordIncome(
    jsonRequest("POST", "/api/admin/income", {
      date: today,
      accountCode: sourceType === "suiteBooking" ? "4500" : "4400",
      description: "Booking",
      amount: String(amount),
      vatAmount: String(vatAmount),
      method,
      payerName: "Kian",
      sourceType,
      sourceId,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Income>(response);
}

function refund(as: TestUserKey, stayId: string, body: Record<string, unknown>) {
  signInAs(as);
  return refundStay(
    jsonRequest("POST", `/api/admin/suite-bookings/${stayId}/refunds`, { method: "cash", reason: "", ...body }),
    routeParams({ id: stayId }),
  );
}

/** A stay as the front desk's list shows it, with what's been paid and handed back. */
async function stayOnList(id: string): Promise<SuiteBooking> {
  signInAs("staff");
  const response = await listStays(getRequest(`/api/admin/suite-bookings?from=${today}`));
  const stay = (await readJson<SuiteBooking[]>(response)).find((row) => row.id === id);
  if (!stay) throw new Error(`S-${id} isn't on the list`);
  return stay;
}

describe("a table deposit", () => {
  it("is held on Deposits held, then handed back the way it came", async () => {
    const id = await aReservation("confirmed");
    const [bank, held] = [await balance("1120"), await balance("2400")];

    const taken = await deposit("staff", id, { amount: "500000", method: "card" });
    expect(taken.status).toBe(200);
    expect((await readJson<Reservation>(taken)).deposit).toEqual({ amount: 500000, method: "card", state: "held" });
    expect(await balance("1120")).toBe(bank + 500000);
    expect(await balance("2400")).toBe(held - 500000);

    // A second deposit, or settling one while the party is still due, is refused.
    expect((await deposit("staff", id, { amount: "1000", method: "cash" })).status).toBe(409);
    expect((await deposit("staff", id, { settle: "returned" }, "PATCH")).status).toBe(409);

    await prisma.reservation.update({ where: { id }, data: { status: "completed" } });
    const returned = await deposit("staff", id, { settle: "returned" }, "PATCH");
    expect(returned.status).toBe(200);
    expect((await readJson<Reservation>(returned)).deposit?.state).toBe("returned");
    expect(await balance("1120")).toBe(bank);
    expect(await balance("2400")).toBe(held);
    expect((await deposit("staff", id, { settle: "kept" }, "PATCH")).status).toBe(401);
    await expectBooksBalance();

    const log = await prisma.activityEntry.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } });
    expect(log.map((entry) => entry.action)).toEqual(["reservation.depositTaken", "reservation.depositReturned"]);
  });

  it("is kept as other income on a no-show — by someone who keeps the books", async () => {
    const id = await aReservation("seated");
    const [cash, held, otherIncome] = [await balance("1110"), await balance("2400"), await balance("4900")];
    await deposit("staff", id, { amount: "300000", method: "cash" });
    await prisma.reservation.update({ where: { id }, data: { status: "noShow" } });

    expect((await deposit("staff", id, { settle: "kept" }, "PATCH")).status).toBe(401);
    const kept = await deposit("admin", id, { settle: "kept" }, "PATCH");

    expect(kept.status).toBe(200);
    expect(await balance("4900")).toBe(otherIncome - 300000);
    expect(await balance("2400")).toBe(held);
    expect(await balance("1110")).toBe(cash + 300000);
    // Settled once only.
    expect((await deposit("admin", id, { settle: "returned" }, "PATCH")).status).toBe(409);
  });

  it("needs reservations.manage, a booking that's still on, and an amount and a counter method", async () => {
    const id = await aReservation("requested");

    expect((await deposit("customer", id, { amount: "1000", method: "cash" })).status).toBe(401);
    expect((await deposit(null, id, { amount: "1000", method: "cash" })).status).toBe(401);
    const online = await deposit("staff", id, { amount: "1000", method: "online" });
    expect(online.status).toBe(400);
    expect((await readError(online)).fieldErrors?.method).toBe("paymentInvalid");
    expect((await deposit("staff", id, { amount: "0", method: "cash" })).status).toBe(400);

    const done = await aReservation("completed");
    expect((await deposit("staff", done, { amount: "1000", method: "cash" })).status).toBe(409);
    expect((await deposit("staff", "nope", { amount: "1000", method: "cash" })).status).toBe(404);
  });
});

describe("the suite's price", () => {
  it("is set by someone who keeps the books, and snapshotted onto each new stay", async () => {
    signInAs("staff");
    expect(await readJson<SuiteSettings>(await readSuitePrice())).toEqual({ nightlyRate: 2500000 });
    const refused = await setSuitePrice(
      jsonRequest("PUT", "/api/admin/suite-bookings/settings", { nightlyRate: "3000000" }),
    );
    expect(refused.status).toBe(401);

    signInAs("admin");
    const saved = await setSuitePrice(
      jsonRequest("PUT", "/api/admin/suite-bookings/settings", { nightlyRate: "3000000" }),
    );
    expect(await readJson<SuiteSettings>(saved)).toEqual({ nightlyRate: 3000000 });

    const stay = await aStay();
    expect(stay.nightlyRate).toBe(3000000);

    // The price moving later leaves the stay at its own rate.
    await setSuitePrice(jsonRequest("PUT", "/api/admin/suite-bookings/settings", { nightlyRate: "4000000" }));
    const listed = await stayOnList(stay.id);
    expect(listed.nightlyRate).toBe(3000000);
    expect(suiteStayMoney(listed)).toMatchObject({ total: 6000000, balance: 6000000 });
  });

  it("can be changed for one stay, and the total follows", async () => {
    const stay = await aStay();

    signInAs("staff");
    const refused = await setStayRate(
      jsonRequest("PUT", `/api/admin/suite-bookings/${stay.id}/rate`, { nightlyRate: "2000000" }),
      routeParams({ id: stay.id }),
    );
    expect(refused.status).toBe(401);

    signInAs("admin");
    const saved = await setStayRate(
      jsonRequest("PUT", `/api/admin/suite-bookings/${stay.id}/rate`, { nightlyRate: "2000000" }),
      routeParams({ id: stay.id }),
    );
    expect(saved.status).toBe(200);
    expect(suiteStayMoney(await stayOnList(stay.id)).total).toBe(4000000);

    signInAs("admin");
    const bad = await setStayRate(
      jsonRequest("PUT", `/api/admin/suite-bookings/${stay.id}/rate`, { nightlyRate: "-5" }),
      routeParams({ id: stay.id }),
    );
    expect(bad.status).toBe(400);
  });

  it("gives an unpriced stay today's rate when it's confirmed", async () => {
    const row = await prisma.suiteBooking.create({
      data: {
        guestName: "Old request",
        guestPhone: "09121112222",
        guests: 1,
        checkIn: new Date(`${shiftCafeDay(today, 20)}T00:00:00.000Z`),
        checkOut: new Date(`${shiftCafeDay(today, 21)}T00:00:00.000Z`),
        status: "requested",
      },
    });
    expect(row.nightRate).toBeNull();

    signInAs("staff");
    await changeStay(
      jsonRequest("PATCH", `/api/admin/suite-bookings/${row.id}`, { status: "confirmed" }),
      routeParams({ id: row.id }),
    );
    expect((await prisma.suiteBooking.findUniqueOrThrow({ where: { id: row.id } })).nightRate).toBe(BigInt(2500000));
  });
});

describe("a refund", () => {
  it("hands back part of a stay's payments, against their revenue and VAT, and shows on the stay", async () => {
    const stay = await aStay();
    await pay("suiteBooking", stay.id, 2_200_000, 200_000, "card");
    await pay("suiteBooking", stay.id, 2_800_000, 0);
    const [suite, vat, bank] = [await balance("4500"), await balance("2200"), await balance("1120")];

    const response = await refund("admin", stay.id, { amount: "3000000", method: "transfer", reason: "Shorter stay" });
    expect(response.status).toBe(201);
    const refunds = await readJson<IncomeRefund[]>(response);
    // Newest payment first: all of the second, then 200,000 of the first (with its VAT share).
    expect(refunds.map((row) => [row.amount, row.vatAmount])).toEqual([
      [2_800_000, 0],
      [200_000, 18_182],
    ]);

    expect(await balance("4500")).toBe(suite + 2_800_000 + 200_000 - 18_182);
    expect(await balance("2200")).toBe(vat + 18_182);
    expect(await balance("1120")).toBe(bank - 3_000_000);
    await expectBooksBalance();

    const listed = await stayOnList(stay.id);
    expect(listed).toMatchObject({ paidAmount: 5_000_000, refundedAmount: 3_000_000, nightlyRate: 2_500_000 });
    // Two nights at 2,500,000, with 2,000,000 paid and kept: 3,000,000 still to pay.
    expect(suiteStayMoney(listed).balance).toBe(3_000_000);

    // The guest is told by phone, account or not.
    const notice = await prisma.notification.findFirst({ where: { kind: "refundIssued" } });
    expect(notice).toMatchObject({ userId: "09127770000", link: "/suite" });
    expect(notice?.params).toMatchObject({ amount: 3_000_000, subject: "suite", reference: stay.reference });
  });

  it("refuses more than was paid and not yet refunded, and needs accounting.write", async () => {
    const stay = await aStay();
    await pay("suiteBooking", stay.id, 1_000_000, 0);
    await refund("admin", stay.id, { amount: "600000" });

    const over = await refund("admin", stay.id, { amount: "400001" });
    expect(over.status).toBe(400);
    expect((await readError(over)).fieldErrors?.amount).toBe("refundOverPaid");
    expect((await refund("staff", stay.id, { amount: "1000" })).status).toBe(401);
    expect((await refund("admin", "nope", { amount: "1000" })).status).toBe(404);

    expect((await refund("admin", stay.id, { amount: "400000" })).status).toBe(201);
    expect((await refund("admin", stay.id, { amount: "1" })).status).toBe(400);
    expect(await prisma.incomeRefund.count({ where: { sourceId: stay.id } })).toBe(2);
  });

  it("is reversed with its payment when the payment is voided, leaving nothing refunded", async () => {
    const stay = await aStay();
    const payment = await pay("suiteBooking", stay.id, 1_000_000, 0);
    await refund("admin", stay.id, { amount: "400000" });
    const cash = await balance("1110");

    signInAs("admin");
    await voidIncome(
      jsonRequest("POST", `/api/admin/income/${payment.id}/void`, { reason: "Handed back the rest" }),
      routeParams({ id: payment.id }),
    );

    // Voiding hands back only what the guest hadn't had back yet.
    expect(await balance("1110")).toBe(cash - 600_000);
    expect(await stayOnList(stay.id)).toMatchObject({ paidAmount: 0, refundedAmount: 0 });
    await expectBooksBalance();
  });

  it("hands back an event sign-up's tickets", async () => {
    const registration = await prisma.eventRegistration.create({
      data: {
        eventId: EVENT,
        userId: TEST_USERS.customer.id,
        guestName: "Test Guest",
        guestPhone: "09120000004",
        seats: 2,
      },
    });
    await pay("eventRegistration", registration.id, 300_000, 0);
    await prisma.eventRegistration.update({ where: { id: registration.id }, data: { status: "cancelled" } });
    const tickets = await balance("4400");

    signInAs("staff");
    const refused = await refundRegistration(
      jsonRequest("POST", `/api/admin/events/${EVENT}/registrations/${registration.id}/refunds`, {
        amount: "300000",
        method: "cash",
      }),
      routeParams({ id: EVENT, registrationId: registration.id }),
    );
    expect(refused.status).toBe(401);

    signInAs("admin");
    const done = await refundRegistration(
      jsonRequest("POST", `/api/admin/events/${EVENT}/registrations/${registration.id}/refunds`, {
        amount: "300000",
        method: "cash",
        reason: "Event moved",
      }),
      routeParams({ id: EVENT, registrationId: registration.id }),
    );
    expect(done.status).toBe(201);
    expect(await balance("4400")).toBe(tickets + 300_000);

    const listed = await readJson<EventRegistration[]>(
      await listRegistrations(getRequest(`/api/admin/events/${EVENT}/registrations`), routeParams({ id: EVENT })),
    );
    expect(listed.find((row) => row.id === registration.id)).toMatchObject({
      paidAmount: 300_000,
      refundedAmount: 300_000,
    });

    const wrongEvent = await refundRegistration(
      jsonRequest("POST", `/api/admin/events/seed-event-reading/registrations/${registration.id}/refunds`, {
        amount: "1",
        method: "cash",
      }),
      routeParams({ id: "seed-event-reading", registrationId: registration.id }),
    );
    expect(wrongEvent.status).toBe(404);
  });
});
