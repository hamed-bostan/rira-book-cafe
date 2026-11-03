import { describe, expect, it } from "vitest";

import { holdPickupDeadline } from "../../../entities/BookWaitlist";
import { wallTimeToDate } from "../../../entities/CafeTime";
import { REMINDER_LATE_LIMIT_MINUTES } from "../../../entities/Reminder";
import {
  dueEventReminder,
  dueHoldReminder,
  dueLoanReminder,
  dueReservationReminders,
  dueSuiteReminder,
  holdExpiredNotification,
  loanReminder,
  reservationExpiredNotification,
  suiteExpiredNotification,
} from "../guestNotifications";

import type { BookLoan } from "../../../entities/BookLoan";
import type { BookWaitlistEntry } from "../../../entities/BookWaitlist";
import type { CafeEvent, EventRegistration } from "../../../entities/CafeEvent";
import type { Reservation } from "../../../entities/Reservation";
import type { SuiteBooking } from "../../../entities/SuiteBooking";

const MINUTE = 60 * 1000;
const LATE = REMINDER_LATE_LIMIT_MINUTES * MINUTE;
const at = (wallTime: string, offsetMs = 0): Date => new Date(wallTimeToDate(wallTime).getTime() + offsetMs);
const iso = (wallTime: string): string => wallTimeToDate(wallTime).toISOString();

/** A table for Thursday 5 Nov at 19:30, booked days before, with the phone typed loosely. */
function table(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "r1",
    reference: 12,
    guestName: "Sara",
    guestPhone: "+98 912 345 6789",
    partySize: 4,
    startsAt: iso("2026-11-05T19:30"),
    durationMinutes: 90,
    status: "confirmed",
    tableLabel: "7",
    createdAt: iso("2026-11-01T10:00"),
    updatedAt: iso("2026-11-01T10:00"),
    ...overrides,
  };
}

describe("dueReservationReminders", () => {
  it("reminds the evening before, to the guest's normalized phone, keyed with the time", () => {
    expect(dueReservationReminders(table(), at("2026-11-04T18:00", -1))).toEqual([]);
    expect(dueReservationReminders(table(), at("2026-11-04T18:00"))).toEqual([
      {
        userId: "09123456789",
        kind: "reservationTomorrow",
        params: { reference: 12, startsAt: iso("2026-11-05T19:30"), partySize: 4, tableLabel: "7" },
        link: "/reservations",
        dedupeKey: `reservation:r1:tomorrow:${iso("2026-11-05T19:30")}`,
      },
    ]);
  });

  it("reminds about two hours before", () => {
    expect(dueReservationReminders(table(), at("2026-11-05T17:30", -1))).toEqual([]);
    expect(dueReservationReminders(table(), at("2026-11-05T17:30")).map((n) => [n.kind, n.dedupeKey])).toEqual([
      ["reservationSoon", `reservation:r1:soon:${iso("2026-11-05T19:30")}`],
    ]);
  });

  it("skips a reminder the jobs got to too late rather than sending it late", () => {
    expect(dueReservationReminders(table(), at("2026-11-04T18:00", LATE - 1))).toHaveLength(1);
    expect(dueReservationReminders(table(), at("2026-11-04T18:00", LATE))).toEqual([]);
    expect(dueReservationReminders(table(), at("2026-11-05T17:30", LATE))).toEqual([]);
  });

  it("sends nothing for a table booked an hour ahead", () => {
    const lastMinute = table({ createdAt: iso("2026-11-05T18:30") });
    for (const now of [at("2026-11-05T18:30"), at("2026-11-05T18:35"), at("2026-11-05T19:00")]) {
      expect(dueReservationReminders(lastMinute, now)).toEqual([]);
    }
  });

  it("only for a confirmed table that hasn't started", () => {
    expect(dueReservationReminders(table({ status: "requested" }), at("2026-11-04T18:00"))).toEqual([]);
    expect(dueReservationReminders(table({ status: "cancelled" }), at("2026-11-05T17:30"))).toEqual([]);
    const early = table({ startsAt: iso("2026-11-05T17:40") });
    expect(dueReservationReminders(early, at("2026-11-05T17:40"))).toEqual([]);
  });

  it("reminds a moved table afresh, under a new key", () => {
    const moved = table({ startsAt: iso("2026-11-06T19:30") });
    const [first] = dueReservationReminders(table(), at("2026-11-04T18:00"));
    const [again] = dueReservationReminders(moved, at("2026-11-05T18:00"));
    expect(again.kind).toBe("reservationTomorrow");
    expect(again.dedupeKey).not.toBe(first.dedupeKey);
  });
});

function stay(overrides: Partial<SuiteBooking> = {}): SuiteBooking {
  return {
    id: "s1",
    reference: 4,
    guestName: "Hamid",
    guestPhone: "0935 111 2233",
    guests: 2,
    checkIn: "2026-11-05",
    checkOut: "2026-11-07",
    status: "confirmed",
    createdAt: iso("2026-11-01T10:00"),
    updatedAt: iso("2026-11-01T10:00"),
    ...overrides,
  };
}

describe("dueSuiteReminder", () => {
  it("reminds the evening before the arrival day", () => {
    expect(dueSuiteReminder(stay(), at("2026-11-04T18:00", -1))).toBeNull();
    expect(dueSuiteReminder(stay(), at("2026-11-04T18:00"))).toEqual({
      userId: "09351112233",
      kind: "suiteTomorrow",
      params: { reference: 4, checkIn: "2026-11-05", checkOut: "2026-11-07" },
      link: "/suite",
      dedupeKey: "suite:s1:tomorrow:2026-11-05",
    });
    expect(dueSuiteReminder(stay(), at("2026-11-04T18:00", LATE))).toBeNull();
  });

  it("skips a stay booked after that evening, or one not confirmed", () => {
    expect(dueSuiteReminder(stay({ createdAt: iso("2026-11-04T18:10") }), at("2026-11-04T18:15"))).toBeNull();
    expect(dueSuiteReminder(stay({ status: "requested" }), at("2026-11-04T18:00"))).toBeNull();
  });
});

describe("dueEventReminder", () => {
  const event = {
    id: "e1",
    title: "Book club",
    titleFa: "باشگاه کتاب",
    startsAt: iso("2026-11-05T17:00"),
  } as CafeEvent;
  const registration: EventRegistration = {
    id: "g1",
    eventId: "e1",
    userId: "09120000004",
    guestName: "Test Guest",
    guestPhone: "09120000004",
    seats: 2,
    status: "registered",
    createdAt: iso("2026-10-30T10:00"),
  };

  it("reminds the evening before, with the Persian title alongside", () => {
    expect(dueEventReminder(event, registration, at("2026-11-04T17:59"))).toBeNull();
    expect(dueEventReminder(event, registration, at("2026-11-04T18:00"))).toEqual({
      userId: "09120000004",
      kind: "eventTomorrow",
      params: { title: "Book club", titleFa: "باشگاه کتاب", startsAt: iso("2026-11-05T17:00"), seats: 2 },
      link: "/events/e1",
      dedupeKey: `event-registration:g1:tomorrow:${iso("2026-11-05T17:00")}`,
    });
  });

  it("skips a cancelled sign-up, and one made after that evening", () => {
    expect(dueEventReminder(event, { ...registration, status: "cancelled" }, at("2026-11-04T18:00"))).toBeNull();
    const late = { ...registration, createdAt: iso("2026-11-04T18:30") };
    expect(dueEventReminder(event, late, at("2026-11-04T18:40"))).toBeNull();
  });
});

function loan(overrides: Partial<BookLoan> = {}): BookLoan {
  return {
    id: "l1",
    reference: 3,
    productId: "b1",
    bookTitle: "The Blind Owl",
    borrowerName: "Sara",
    borrowerPhone: "09121234567",
    lentAt: iso("2026-10-22T10:00"),
    // Due by the end of Thursday 5 Nov.
    dueAt: "2026-11-05T20:29:59.999Z",
    status: "out",
    depositAmount: 0,
    lentById: "s1",
    lentByName: "Ali",
    createdAt: iso("2026-10-22T10:00"),
    updatedAt: iso("2026-10-22T10:00"),
    ...overrides,
  };
}

describe("dueLoanReminder", () => {
  it("tells a borrower without an account, by phone, the evening before the due day", () => {
    expect(dueLoanReminder(loan(), at("2026-11-04T18:00", -1))).toBeNull();
    expect(dueLoanReminder(loan(), at("2026-11-04T18:00"))).toEqual({
      userId: "09121234567",
      kind: "loanDueSoon",
      params: { title: "The Blind Owl", dueAt: "2026-11-05T20:29:59.999Z" },
      link: "/loans",
      dedupeKey: "loan:l1:loanDueSoon",
    });
  });

  it("shares its key with the inbox's own reminder, so a guest gets it once", () => {
    const withAccount = loan({ userId: "09121234567" });
    const now = at("2026-11-05T12:00");
    const fromInbox = loanReminder(withAccount, now);
    const fromJob = dueLoanReminder(withAccount, at("2026-11-04T18:00"));
    expect(fromJob?.dedupeKey).toBe(fromInbox?.dedupeKey);
    expect(fromJob?.userId).toBe(fromInbox?.userId);
  });

  it("says overdue once it's past due, for as long as it's out", () => {
    expect(dueLoanReminder(loan(), new Date("2026-11-05T20:29:59.999Z"))).toBeNull();
    expect(dueLoanReminder(loan(), new Date("2026-11-05T20:30:00.000Z"))?.dedupeKey).toBe("loan:l1:loanOverdue");
    expect(dueLoanReminder(loan(), at("2026-11-20T10:00"))?.kind).toBe("loanOverdue");
    expect(dueLoanReminder(loan({ status: "returned" }), at("2026-11-20T10:00"))).toBeNull();
  });

  it("doesn't say due tomorrow about a book lent the day before it's due", () => {
    expect(dueLoanReminder(loan({ lentAt: iso("2026-11-04T19:00") }), at("2026-11-04T19:05"))).toBeNull();
  });
});

function told(overrides: Partial<BookWaitlistEntry> = {}): BookWaitlistEntry {
  const notifiedAt = wallTimeToDate("2026-11-03T10:00");
  return {
    id: "w1",
    productId: "b1",
    bookTitle: "The Blind Owl",
    guestName: "Sara",
    guestPhone: "09351112233",
    status: "notified",
    notifiedAt: notifiedAt.toISOString(),
    pickupBy: holdPickupDeadline(notifiedAt).toISOString(),
    createdAt: iso("2026-10-20T10:00"),
    updatedAt: notifiedAt.toISOString(),
    ...overrides,
  };
}

describe("dueHoldReminder", () => {
  it("says collect it by the deadline from when they're told", () => {
    expect(dueHoldReminder(told(), at("2026-11-03T10:05"))).toEqual({
      userId: "09351112233",
      kind: "holdCollectBy",
      params: { title: "The Blind Owl", dueAt: "2026-11-06T20:29:59.999Z" },
      link: "/loans",
      dedupeKey: "waitlist:w1:holdCollectBy",
    });
    expect(dueHoldReminder(told(), at("2026-11-05T23:59"))?.kind).toBe("holdCollectBy");
  });

  it("says it's the last day on the deadline's own day", () => {
    expect(dueHoldReminder(told(), at("2026-11-06T00:00"))).toMatchObject({
      kind: "holdLastDay",
      dedupeKey: "waitlist:w1:holdLastDay",
    });
    expect(dueHoldReminder(told(), new Date("2026-11-06T20:29:59.999Z"))?.kind).toBe("holdLastDay");
  });

  it("says nothing once the deadline's gone, or to a guest still waiting", () => {
    expect(dueHoldReminder(told(), new Date("2026-11-06T20:30:00.000Z"))).toBeNull();
    expect(dueHoldReminder(told({ status: "waiting" }), at("2026-11-04T10:00"))).toBeNull();
  });
});

describe("expiry notices", () => {
  it("tell the guest by phone, once per booking or hold", () => {
    expect(reservationExpiredNotification(table({ status: "cancelled" }))).toMatchObject({
      userId: "09123456789",
      kind: "reservationExpired",
      params: { reference: 12, startsAt: iso("2026-11-05T19:30"), partySize: 4 },
      dedupeKey: "reservation:r1:expired",
    });
    expect(suiteExpiredNotification(stay({ status: "cancelled" }))).toMatchObject({
      userId: "09351112233",
      kind: "suiteExpired",
      dedupeKey: "suite:s1:expired",
    });
    expect(holdExpiredNotification(told({ status: "cancelled" }))).toMatchObject({
      userId: "09351112233",
      kind: "holdExpired",
      params: { title: "The Blind Owl" },
      link: "/menu/b1",
      dedupeKey: "waitlist:w1:expired",
    });
  });
});
