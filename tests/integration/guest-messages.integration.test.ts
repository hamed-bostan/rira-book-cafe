import { describe, expect, it } from "vitest";

import { PATCH as changeLoan } from "@/app/api/admin/book-loans/[id]/route";
import { POST as lend } from "@/app/api/admin/book-loans/route";
import { POST as addHold } from "@/app/api/admin/book-waitlist/route";
import { POST as sendMessage } from "@/app/api/admin/guest-messages/route";
import { PATCH as changeOrderStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { PATCH as changeReservation } from "@/app/api/admin/reservations/[id]/route";
import { POST as bookTable } from "@/app/api/admin/reservations/route";
import { POST as register } from "@/app/api/events/[id]/registrations/route";
import { POST as markRead } from "@/app/api/notifications/read/route";
import { GET as listNotifications } from "@/app/api/notifications/route";
import { GET as unreadCount } from "@/app/api/notifications/unread-count/route";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import type { EventRegistration } from "@/src/domain/entities/CafeEvent";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Notification } from "@/src/domain/entities/Notification";
import type { Order } from "@/src/domain/entities/Order";
import type { Reservation } from "@/src/domain/entities/Reservation";
import { VerifyOtp } from "@/src/domain/use-cases/auth/VerifyOtp";
import { GetOrCreateUser } from "@/src/domain/use-cases/profile/GetOrCreateUser";
import { authRepository, userRepository } from "@/src/infrastructure/container";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs, signInAsUser } from "./helpers/session";

const nextWeek = shiftCafeDay(cafeDayOf(new Date()), 7);
const BLIND_OWL = "seed-book-blind-owl";
const BOOK_CLUB = "seed-event-book-club";

/** Staff book a table for a guest who rang, on the profile their phone finds or makes. */
async function phoneBooking(phone: string, at = "18:30"): Promise<Reservation> {
  signInAs("staff");
  const response = await bookTable(
    jsonRequest("POST", "/api/admin/reservations", {
      guestName: "Sara Ahmadi",
      guestPhone: phone,
      startsAt: `${nextWeek}T${at}`,
      partySize: 2,
      note: "",
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Reservation>(response);
}

/**
 * A guest's first sign-in, the way `auth.ts` runs it: the one-time code checked,
 * then the account created for the phone. Signed in as them afterwards.
 */
async function firstSignIn(typedPhone: string): Promise<string> {
  await authRepository.requestOtp(typedPhone);
  const code = authRepository.peekDevOtp?.(typedPhone) ?? "";
  const identity = await new VerifyOtp(authRepository).execute(typedPhone, code);
  if (!identity) throw new Error("The mock code didn't verify.");
  const user = await new GetOrCreateUser(userRepository).execute(identity);
  signInAsUser(user);
  return user.id;
}

async function inbox(): Promise<{ notifications: Notification[]; unread: number }> {
  const list = await listNotifications();
  expect(list.status).toBe(200);
  const count = await unreadCount();
  return {
    notifications: await readJson<Notification[]>(list),
    unread: (await readJson<{ count: number }>(count)).count,
  };
}

function message(body: unknown): Promise<Response> {
  return sendMessage(jsonRequest("POST", "/api/admin/guest-messages", body));
}

describe("notices reach every guest, signed in or not", () => {
  it("keeps a phone booking's notice in the profile made for it, unread until the guest first signs in", async () => {
    const booking = await phoneBooking("0930 118 4462");
    expect(booking.userId).toBe("09301184462");
    const confirmed = await changeReservation(
      jsonRequest("PATCH", `/api/admin/reservations/${booking.id}`, { status: "confirmed", tableLabel: "3" }),
      routeParams({ id: booking.id }),
    );
    expect(confirmed.status).toBe(200);
    // The profile was made with the booking; nobody has signed in to it yet.
    expect(await prisma.user.findUnique({ where: { id: "09301184462" } })).toMatchObject({
      name: "Sara Ahmadi",
      firstSignedInAt: null,
    });

    const userId = await firstSignIn("+98 930 118 4462");

    expect(userId).toBe("09301184462");
    const { notifications, unread } = await inbox();
    expect(unread).toBe(1);
    expect(notifications).toEqual([
      expect.objectContaining({
        userId: "09301184462",
        kind: "reservationConfirmed",
        link: "/reservations",
        params: expect.objectContaining({ reference: booking.reference, tableLabel: "3" }),
      }),
    ]);
    expect(notifications[0]).not.toHaveProperty("readAt");
  });

  it("tells a guest who joined a book's line at the counter that it's back", async () => {
    signInAs("staff");
    const loan = await readJson<BookLoan>(
      await lend(
        jsonRequest("POST", "/api/admin/book-loans", {
          productId: BLIND_OWL,
          borrowerName: "Niloofar",
          borrowerPhone: "09121110005",
          dueOn: shiftCafeDay(cafeDayOf(new Date()), 14),
          note: "",
        }),
      ),
    );
    const hold = await readJson<BookWaitlistEntry>(
      await addHold(
        jsonRequest("POST", "/api/admin/book-waitlist", {
          productId: BLIND_OWL,
          guestName: "Hamid",
          guestPhone: "0935 111 2233",
        }),
      ),
    );
    // On the profile made with the hold: the guest hasn't signed in yet.
    expect(hold.userId).toBe("09351112233");

    await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${loan.id}`, { status: "returned" }),
      routeParams({ id: loan.id }),
    );

    await firstSignIn("09351112233");
    const { notifications, unread } = await inbox();
    expect(unread).toBe(1);
    expect(notifications[0]).toMatchObject({ kind: "bookAvailable", params: { title: hold.bookTitle } });
    // The counter borrower was told about their loan the same way.
    expect(await prisma.notification.count({ where: { userId: "09121110005", kind: "loanStarted" } })).toBe(1);
  });

  it("tells a counter sale's guest how their order goes, on the profile it was rung up for", async () => {
    signInAs("staff");
    const sale = await readJson<Order>(
      await ringUpSale(
        jsonRequest("POST", "/api/admin/orders", {
          items: [{ productId: "seed-espresso", quantity: 1 }],
          serviceType: "takeaway",
          customerName: "Nima Rad",
          customerPhone: "0912 555 0101",
        }),
      ),
    );
    const moved = await changeOrderStatus(
      jsonRequest("PATCH", `/api/admin/orders/${sale.id}/status`, { status: "preparing" }),
      routeParams({ id: sale.id }),
    );
    expect(moved.status).toBe(200);

    const notices = await prisma.notification.findMany({ where: { userId: "09125550101" } });
    expect(notices).toEqual([expect.objectContaining({ kind: "orderAccepted", link: `/orders/${sale.id}` })]);
  });
});

describe("staff messages", () => {
  it("only lets whoever manages a thing write to its guest", async () => {
    const booking = await phoneBooking("09301184462");
    const aboutBooking = {
      phone: booking.guestPhone,
      text: "See you at 18:30.",
      about: { kind: "reservation", id: booking.id },
    };

    signInAs(null);
    expect((await message(aboutBooking)).status).toBe(401);
    signInAs("customer");
    expect((await message(aboutBooking)).status).toBe(401);

    signInAs("customer");
    const signUp = await readJson<EventRegistration>(
      await register(
        jsonRequest("POST", `/api/events/${BOOK_CLUB}/registrations`, { seats: 1 }),
        routeParams({ id: BOOK_CLUB }),
      ),
    );
    const aboutSignUp = {
      phone: TEST_USERS.customer.phone,
      text: "Bring the book!",
      about: { kind: "eventRegistration", id: signUp.id },
    };
    // Staff manage bookings, not events.
    signInAs("staff");
    expect((await message(aboutSignUp)).status).toBe(401);
    expect((await message(aboutBooking)).status).toBe(201);
    signInAs("admin");
    const sent = await message(aboutSignUp);
    expect(sent.status).toBe(201);
    expect(await readJson<Notification>(sent)).toMatchObject({
      userId: TEST_USERS.customer.id,
      kind: "staffMessage",
      params: { about: "eventRegistration", text: "Bring the book!" },
      link: `/events/${BOOK_CLUB}`,
    });
  });

  it("checks the words, that the thing exists, and that its phone is the one staff saw", async () => {
    const booking = await phoneBooking("09301184462");
    signInAs("staff");
    const about = { kind: "reservation", id: booking.id };

    const empty = await message({ phone: "09301184462", text: "   ", about });
    expect(empty.status).toBe(400);
    expect((await readError(empty)).fieldErrors?.text).toBe("messageRequired");
    const long = await message({ phone: "09301184462", text: "x".repeat(501), about });
    expect((await readError(long)).fieldErrors?.text).toBe("textTooLong");
    expect((await message({ phone: "09301184462", text: "Hi", about: { kind: "payroll", id: "p1" } })).status).toBe(
      400,
    );

    expect(
      (await message({ phone: "09301184462", text: "Hi", about: { kind: "reservation", id: "nope" } })).status,
    ).toBe(404);
    const someoneElse = await message({ phone: "09121110004", text: "Hi", about });
    expect(someoneElse.status).toBe(409);
    expect((await readError(someoneElse)).code).toBe("GUEST_CHANGED");

    expect(await prisma.notification.count({ where: { kind: "staffMessage" } })).toBe(0);
  });

  it("keeps the words as typed, and logs who wrote what to which guest about what", async () => {
    const booking = await phoneBooking("0930 118 4462");
    signInAs("staff");
    const text = "<b>Table 7</b> by the window\nis yours.";

    const sent = await message({ phone: "+98 930 118 4462", text, about: { kind: "reservation", id: booking.id } });

    expect(sent.status).toBe(201);
    const stored = await prisma.notification.findFirstOrThrow({ where: { kind: "staffMessage" } });
    expect(stored).toMatchObject({ userId: "09301184462", link: "/reservations" });
    expect(stored.params).toEqual({ about: "reservation", reference: booking.reference, text });

    const entries = await prisma.activityEntry.findMany({ where: { action: "reservation.guestMessaged" } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorId: TEST_USERS.staff.id,
      actorName: TEST_USERS.staff.name,
      entityType: "reservation",
      entityId: booking.id,
      entityLabel: `R-${booking.reference}`,
      changes: [
        { field: "guest", before: null, after: "Sara Ahmadi (0930 118 4462)" },
        { field: "message", before: null, after: text },
      ],
    });
  });
});

describe("unread messages", () => {
  it("counts every unread message, the guest's own and staff's, until they're marked read", async () => {
    signInAs("customer");
    const signUp = await readJson<EventRegistration>(
      await register(
        jsonRequest("POST", `/api/events/${BOOK_CLUB}/registrations`, { seats: 2 }),
        routeParams({ id: BOOK_CLUB }),
      ),
    );
    signInAs("admin");
    for (const text of ["Doors open at 7.", "We've saved you two seats at the front."]) {
      const sent = await message({
        phone: TEST_USERS.customer.phone,
        text,
        about: { kind: "eventRegistration", id: signUp.id },
      });
      expect(sent.status).toBe(201);
    }

    signInAs("customer");
    const before = await inbox();
    expect(before.unread).toBe(2);
    expect(before.notifications.map((notification) => notification.params.text).sort()).toEqual([
      "Doors open at 7.",
      "We've saved you two seats at the front.",
    ]);

    expect((await markRead()).status).toBe(204);
    const after = await inbox();
    expect(after.unread).toBe(0);
    expect(after.notifications.every((notification) => notification.readAt)).toBe(true);
  });
});
