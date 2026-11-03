import { describe, expect, it } from "vitest";

import {
  bookAvailableNotification,
  loanReminder,
  loanStartedNotification,
  orderStatusNotification,
  reservationNotification,
  staffMessageNotification,
  suiteNotification,
} from "../guestNotifications";

import type { BookLoan } from "../../../entities/BookLoan";
import type { BookWaitlistEntry } from "../../../entities/BookWaitlist";
import type { Order, OrderStatus } from "../../../entities/Order";
import type { Reservation, ReservationStatus } from "../../../entities/Reservation";
import type { SuiteBooking, SuiteBookingStatus } from "../../../entities/SuiteBooking";

const NOW = new Date("2026-10-20T10:00:00Z");

function order(status: OrderStatus, overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: 42,
    userId: "g1",
    customerName: "Sara",
    customerPhone: "0912",
    status,
    serviceType: "takeaway",
    paymentStatus: "unpaid",
    items: [],
    subtotal: 100_000,
    promoDiscount: 0,
    pointsRedeemed: 0,
    pointsDiscount: 0,
    pointsEarned: 0,
    refundedTotal: 0,
    total: 100_000,
    placedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function loan(dueAt: string, overrides: Partial<BookLoan> = {}): BookLoan {
  return {
    id: "l1",
    reference: 3,
    productId: "b1",
    bookTitle: "The Blind Owl",
    userId: "g1",
    borrowerName: "Sara",
    borrowerPhone: "09121234567",
    lentAt: "2026-10-01T10:00:00Z",
    dueAt,
    status: "out",
    depositAmount: 0,
    lentById: "s1",
    lentByName: "Ali",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function reservation(status: ReservationStatus, overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "r1",
    reference: 12,
    guestName: "Sara",
    guestPhone: "+98 912 123 4567",
    partySize: 2,
    startsAt: "2026-10-21T15:00:00Z",
    durationMinutes: 90,
    status,
    tableLabel: "4",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function stay(status: SuiteBookingStatus, overrides: Partial<SuiteBooking> = {}): SuiteBooking {
  return {
    id: "s1",
    reference: 4,
    guestName: "Sara",
    guestPhone: "۰۹۱۲۱۲۳۴۵۶۷",
    guests: 2,
    checkIn: "2026-10-25",
    checkOut: "2026-10-27",
    status,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function hold(overrides: Partial<BookWaitlistEntry> = {}): BookWaitlistEntry {
  return {
    id: "w1",
    productId: "b1",
    bookTitle: "Savushun",
    guestName: "Ali",
    guestPhone: "09121110004",
    status: "notified",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("orderStatusNotification", () => {
  it("tells the guest their order is being prepared, keyed so it's sent once", () => {
    expect(orderStatusNotification(order("preparing"))).toMatchObject({
      userId: "g1",
      kind: "orderAccepted",
      params: { orderNumber: 42, serviceType: "takeaway" },
      link: "/orders/o1",
      dedupeKey: "order:o1:preparing",
    });
  });

  it("stays quiet about the guest's own placement", () => {
    expect(orderStatusNotification(order("pending"))).toBeNull();
  });

  it("says what a completed order earned instead of a plain 'done'", () => {
    expect(orderStatusNotification(order("completed", { pointsEarned: 10 }))).toMatchObject({
      kind: "pointsEarned",
      params: { points: 10 },
    });
    expect(orderStatusNotification(order("completed"))?.kind).toBe("orderCompleted");
  });

  it("tells a counter sale's guest by the phone it was rung up with, with no link to an account page", () => {
    const counter = order("cancelled", { userId: undefined, customerPhone: "0912 123 4567" });
    const notification = orderStatusNotification(counter);
    expect(notification).toMatchObject({ userId: "09121234567", kind: "orderCancelled" });
    expect(notification).not.toHaveProperty("link");
  });

  it("has nobody to tell for a counter sale without a phone", () => {
    expect(orderStatusNotification(order("preparing", { userId: undefined, customerPhone: "" }))).toBeNull();
  });
});

describe("booking notices", () => {
  it("address a phone booking by the normalized phone, so it waits for the guest's first sign-in", () => {
    const table = reservationNotification(reservation("confirmed"));
    expect(table).toMatchObject({ userId: "09121234567", kind: "reservationConfirmed", params: { reference: 12 } });
    expect(table).not.toHaveProperty("link");

    const suite = suiteNotification(stay("cancelled"));
    expect(suite).toMatchObject({ userId: "09121234567", kind: "suiteCancelled" });
    expect(suite).not.toHaveProperty("link");
  });

  it("go to the account, with a link to the guest's own page, when the booking is on one", () => {
    expect(reservationNotification(reservation("confirmed", { userId: "g1" }))).toMatchObject({
      userId: "g1",
      link: "/reservations",
    });
    expect(suiteNotification(stay("confirmed", { userId: "g1" }))).toMatchObject({ userId: "g1", link: "/suite" });
  });

  it("stay quiet about moves that aren't news", () => {
    expect(reservationNotification(reservation("seated"))).toBeNull();
    expect(suiteNotification(stay("checkedIn"))).toBeNull();
  });
});

describe("book notices", () => {
  it("tell a counter borrower about the loan by phone", () => {
    expect(loanStartedNotification(loan("2026-10-30T20:29:59Z", { userId: undefined }))).toMatchObject({
      userId: "09121234567",
      kind: "loanStarted",
      dedupeKey: "loan:l1:started",
    });
  });

  it("tell the guest at the front of the line the book is back — by phone for a counter hold", () => {
    expect(bookAvailableNotification(hold())).toEqual({
      userId: "09121110004",
      kind: "bookAvailable",
      params: { title: "Savushun" },
      dedupeKey: "waitlist:w1:available",
    });
    expect(bookAvailableNotification(hold({ userId: "g2" }))).toMatchObject({ userId: "g2", link: "/loans" });
  });
});

describe("loanReminder", () => {
  it("reminds within two days of the due date, then once overdue", () => {
    expect(loanReminder(loan("2026-10-21T20:29:59Z"), NOW)?.kind).toBe("loanDueSoon");
    expect(loanReminder(loan("2026-10-19T20:29:59Z"), NOW)?.kind).toBe("loanOverdue");
  });

  it("says nothing about a loan far from due, or one that's back", () => {
    expect(loanReminder(loan("2026-11-01T20:29:59Z"), NOW)).toBeNull();
    expect(
      loanReminder(loan("2026-10-19T20:29:59Z", { status: "returned", returnedAt: NOW.toISOString() }), NOW),
    ).toBeNull();
  });

  it("reminds a borrower with no account by their phone", () => {
    expect(loanReminder(loan("2026-10-19T20:29:59Z", { userId: undefined }), NOW)).toMatchObject({
      userId: "09121234567",
      kind: "loanOverdue",
    });
  });
});

describe("staffMessageNotification", () => {
  it("carries the words and what they're about, never deduplicated", () => {
    const notification = staffMessageNotification(
      { phone: "0912-123-4567" },
      "We've kept the window table for you.",
      { about: "reservation", reference: 12 },
      undefined,
    );
    expect(notification).toEqual({
      userId: "09121234567",
      kind: "staffMessage",
      params: { about: "reservation", reference: 12, text: "We've kept the window table for you." },
    });
  });

  it("goes to the account, with the link it's given, when there is one", () => {
    expect(staffMessageNotification({ userId: "g1", phone: "0912" }, "Hi", { about: "order" }, "/orders/o1")).toEqual({
      userId: "g1",
      kind: "staffMessage",
      params: { about: "order", text: "Hi" },
      link: "/orders/o1",
    });
  });
});
