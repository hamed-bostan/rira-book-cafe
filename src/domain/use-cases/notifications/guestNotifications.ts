import { isBookLoanOverdue, type BookLoan } from "../../entities/BookLoan";
import { cafeDayOf } from "../../entities/CafeTime";
import { LOAN_REMINDER_HOURS, type NewNotification } from "../../entities/Notification";
import { normalizePhone } from "../../entities/Phone";
import { eveningBefore, isReminderDue, soonBefore } from "../../entities/Reminder";

import type { BookWaitlistEntry } from "../../entities/BookWaitlist";
import type { CafeEvent, EventRegistration } from "../../entities/CafeEvent";
import type { Order, OrderStatus } from "../../entities/Order";
import type { Reservation } from "../../entities/Reservation";
import type { SuiteBooking } from "../../entities/SuiteBooking";

/**
 * What each change tells the guest, as pure functions of the record after the
 * change — `null` when it isn't news to them. The use-cases decide *when* to send;
 * these decide *what*.
 */

/**
 * `preparing` keeps the `orderAccepted` kind (staff took it and are making it), so
 * notifications already stored still read right. `orderReady` is no longer sent —
 * there's no separate "ready" step — but stays a known kind for old rows.
 */
const ORDER_KINDS: Partial<Record<OrderStatus, NewNotification["kind"]>> = {
  preparing: "orderAccepted",
  completed: "orderCompleted",
  cancelled: "orderCancelled",
};

/** An order moved. A served order that earned points says so instead of a plain "served". */
export function orderStatusNotification(order: Order): NewNotification | null {
  // A counter sale has no account to tell.
  if (!order.userId) return null;
  if (order.status === "completed" && order.pointsEarned > 0) {
    return {
      userId: order.userId,
      kind: "pointsEarned",
      params: { orderNumber: order.orderNumber, points: order.pointsEarned },
      link: "/rewards",
      dedupeKey: `order:${order.id}:pointsEarned`,
    };
  }
  const kind = ORDER_KINDS[order.status];
  if (!kind) return null;
  return {
    userId: order.userId,
    kind,
    params: { orderNumber: order.orderNumber, serviceType: order.serviceType },
    link: `/orders/${order.id}`,
    dedupeKey: `order:${order.id}:${order.status}`,
  };
}

/** Staff confirmed or cancelled a table. A guest's own cancellation isn't news to them. */
export function reservationNotification(reservation: Reservation): NewNotification | null {
  const kind =
    reservation.status === "confirmed"
      ? "reservationConfirmed"
      : reservation.status === "cancelled"
        ? "reservationCancelled"
        : null;
  // A phone or walk-in booking has no account to tell.
  if (!kind || !reservation.userId) return null;
  return {
    userId: reservation.userId,
    kind,
    params: {
      reference: reservation.reference,
      startsAt: reservation.startsAt,
      partySize: reservation.partySize,
      ...(reservation.tableLabel ? { tableLabel: reservation.tableLabel } : {}),
    },
    link: "/reservations",
    dedupeKey: `reservation:${reservation.id}:${reservation.status}`,
  };
}

/** Staff confirmed or cancelled a suite stay. */
export function suiteNotification(booking: SuiteBooking): NewNotification | null {
  const kind =
    booking.status === "confirmed" ? "suiteConfirmed" : booking.status === "cancelled" ? "suiteCancelled" : null;
  if (!kind || !booking.userId) return null;
  return {
    userId: booking.userId,
    kind,
    params: { reference: booking.reference, checkIn: booking.checkIn, checkOut: booking.checkOut },
    link: "/suite",
    dedupeKey: `suite:${booking.id}:${booking.status}`,
  };
}

/** A book went home with a guest who has an account: the loan, and when it's due. */
export function loanStartedNotification(loan: BookLoan): NewNotification | null {
  if (!loan.userId) return null;
  return {
    userId: loan.userId,
    kind: "loanStarted",
    params: { title: loan.bookTitle, dueAt: loan.dueAt },
    link: "/loans",
    dedupeKey: `loan:${loan.id}:started`,
  };
}

/**
 * The reminder a borrowed book is due for at `now`, if any: overdue once it's past
 * due, "due soon" within {@link LOAN_REMINDER_HOURS} of it. Each is keyed per loan,
 * so working this out every time the guest looks sends each reminder once.
 */
export function loanReminder(loan: BookLoan, now: Date): NewNotification | null {
  if (!loan.userId || loan.status !== "out") return null;
  const overdue = isBookLoanOverdue(loan, now);
  const dueSoon = new Date(loan.dueAt).getTime() - now.getTime() <= LOAN_REMINDER_HOURS * 60 * 60 * 1000;
  if (!overdue && !dueSoon) return null;
  const kind = overdue ? "loanOverdue" : "loanDueSoon";
  return {
    userId: loan.userId,
    kind,
    params: { title: loan.bookTitle, dueAt: loan.dueAt },
    link: "/loans",
    dedupeKey: `loan:${loan.id}:${kind}`,
  };
}

// ── From the background jobs ─────────────────────────────────────────────────
// Reminders and expiries, worked out against the clock rather than a change. Each
// goes to the guest's normalized phone — their inbox whether or not they've made
// an account yet (an account's id is that phone) — and is keyed so a job run any
// number of times sends it once. A reminder's key carries the time it's about, so
// a booking moved to a new time is reminded afresh.

/** The reminders a confirmed table is due at `now`: the evening before its day, and about two hours before. */
export function dueReservationReminders(reservation: Reservation, now: Date): NewNotification[] {
  const startsAt = new Date(reservation.startsAt);
  if (reservation.status !== "confirmed" || startsAt <= now) return [];
  const existedSince = new Date(reservation.createdAt);
  const params = {
    reference: reservation.reference,
    startsAt: reservation.startsAt,
    partySize: reservation.partySize,
    ...(reservation.tableLabel ? { tableLabel: reservation.tableLabel } : {}),
  };
  const due: NewNotification[] = [];
  if (isReminderDue(eveningBefore(cafeDayOf(startsAt)), existedSince, now)) {
    due.push({
      userId: normalizePhone(reservation.guestPhone),
      kind: "reservationTomorrow",
      params,
      link: "/reservations",
      dedupeKey: `reservation:${reservation.id}:tomorrow:${reservation.startsAt}`,
    });
  }
  if (isReminderDue(soonBefore(startsAt), existedSince, now)) {
    due.push({
      userId: normalizePhone(reservation.guestPhone),
      kind: "reservationSoon",
      params,
      link: "/reservations",
      dedupeKey: `reservation:${reservation.id}:soon:${reservation.startsAt}`,
    });
  }
  return due;
}

/** The reminder a confirmed suite stay is due at `now`: the evening before the arrival day. */
export function dueSuiteReminder(booking: SuiteBooking, now: Date): NewNotification | null {
  if (booking.status !== "confirmed" || booking.checkIn <= cafeDayOf(now)) return null;
  if (!isReminderDue(eveningBefore(booking.checkIn), new Date(booking.createdAt), now)) return null;
  return {
    userId: normalizePhone(booking.guestPhone),
    kind: "suiteTomorrow",
    params: { reference: booking.reference, checkIn: booking.checkIn, checkOut: booking.checkOut },
    link: "/suite",
    dedupeKey: `suite:${booking.id}:tomorrow:${booking.checkIn}`,
  };
}

/**
 * The reminder a guest signed up for an event is due at `now`: the evening before
 * its day. The Persian title rides along (`titleFa`) for a guest reading in Persian.
 */
export function dueEventReminder(event: CafeEvent, registration: EventRegistration, now: Date): NewNotification | null {
  const startsAt = new Date(event.startsAt);
  if (registration.status !== "registered" || startsAt <= now) return null;
  if (!isReminderDue(eveningBefore(cafeDayOf(startsAt)), new Date(registration.createdAt), now)) return null;
  return {
    userId: normalizePhone(registration.guestPhone),
    kind: "eventTomorrow",
    params: {
      title: event.title,
      ...(event.titleFa ? { titleFa: event.titleFa } : {}),
      startsAt: event.startsAt,
      seats: registration.seats,
    },
    link: `/events/${event.id}`,
    dedupeKey: `event-registration:${registration.id}:tomorrow:${event.startsAt}`,
  };
}

/**
 * The reminder a borrowed book is due at `now`, for every borrower — one without an
 * account too: "due tomorrow" the evening before its due day, and "overdue" once
 * it's past due. Keyed as {@link loanReminder} keys them (the inbox still works
 * those out when a guest with an account looks), so whichever comes first sends
 * it and the other sends nothing.
 */
export function dueLoanReminder(loan: BookLoan, now: Date): NewNotification | null {
  if (loan.status !== "out") return null;
  const overdue = isBookLoanOverdue(loan, now);
  if (!overdue && !isReminderDue(eveningBefore(cafeDayOf(new Date(loan.dueAt))), new Date(loan.lentAt), now)) {
    return null;
  }
  const kind = overdue ? "loanOverdue" : "loanDueSoon";
  return {
    userId: normalizePhone(loan.borrowerPhone),
    kind,
    params: { title: loan.bookTitle, dueAt: loan.dueAt },
    link: "/loans",
    dedupeKey: `loan:${loan.id}:${kind}`,
  };
}

/**
 * What a guest told their book is back is due at `now` about collecting it:
 * "collect it by …" from when they're told, then "last day to collect" on the
 * deadline's own day. Nothing once it's gone — the jobs skip them then.
 */
export function dueHoldReminder(entry: BookWaitlistEntry, now: Date): NewNotification | null {
  if (entry.status !== "notified" || !entry.pickupBy || new Date(entry.pickupBy) < now) return null;
  const kind = cafeDayOf(new Date(entry.pickupBy)) === cafeDayOf(now) ? "holdLastDay" : "holdCollectBy";
  return {
    userId: normalizePhone(entry.guestPhone),
    kind,
    // `dueAt`: the deadline reads as its day, like a loan's due date.
    params: { title: entry.bookTitle, dueAt: entry.pickupBy },
    link: "/loans",
    dedupeKey: `waitlist:${entry.id}:${kind}`,
  };
}

/** A table request nobody answered before it began, now cancelled: "we couldn't confirm it in time". */
export function reservationExpiredNotification(reservation: Reservation): NewNotification {
  return {
    userId: normalizePhone(reservation.guestPhone),
    kind: "reservationExpired",
    params: { reference: reservation.reference, startsAt: reservation.startsAt, partySize: reservation.partySize },
    link: "/reservations",
    dedupeKey: `reservation:${reservation.id}:expired`,
  };
}

/** A stay request nobody answered by its arrival day, now cancelled. */
export function suiteExpiredNotification(booking: SuiteBooking): NewNotification {
  return {
    userId: normalizePhone(booking.guestPhone),
    kind: "suiteExpired",
    params: { reference: booking.reference, checkIn: booking.checkIn, checkOut: booking.checkOut },
    link: "/suite",
    dedupeKey: `suite:${booking.id}:expired`,
  };
}

/** A told guest who didn't collect the book in time, skipped — linked to the book, to join its line again. */
export function holdExpiredNotification(entry: BookWaitlistEntry): NewNotification {
  return {
    userId: normalizePhone(entry.guestPhone),
    kind: "holdExpired",
    params: { title: entry.bookTitle },
    link: `/menu/${entry.productId}`,
    dedupeKey: `waitlist:${entry.id}:expired`,
  };
}
