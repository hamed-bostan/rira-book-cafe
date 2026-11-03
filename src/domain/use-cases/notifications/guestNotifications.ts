import { isBookLoanOverdue, type BookLoan } from "../../entities/BookLoan";
import { LOAN_REMINDER_HOURS, type NewNotification } from "../../entities/Notification";
import { normalizePhone } from "../../entities/Phone";

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

/**
 * Staff moved a table booking, or changed how many it's for or how long it holds
 * the table: the booking as it is now. Addressed by the guest's phone, so a phone
 * or walk-in guest finds it once they sign in with that number; keyed on the
 * save, so each change is told once.
 */
export function reservationChangedNotification(reservation: Reservation): NewNotification {
  return {
    userId: normalizePhone(reservation.guestPhone),
    kind: "reservationChanged",
    params: {
      reference: reservation.reference,
      startsAt: reservation.startsAt,
      partySize: reservation.partySize,
      durationMinutes: reservation.durationMinutes,
    },
    link: "/reservations",
    dedupeKey: `reservation:${reservation.id}:changed:${reservation.updatedAt}`,
  };
}

/** Staff changed a suite stay's days or party: the stay as it is now, told once per change. */
export function suiteChangedNotification(booking: SuiteBooking): NewNotification {
  return {
    userId: normalizePhone(booking.guestPhone),
    kind: "suiteChanged",
    params: {
      reference: booking.reference,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
    },
    link: "/suite",
    dedupeKey: `suite:${booking.id}:changed:${booking.updatedAt}`,
  };
}

/**
 * What a change to an event tells a guest signed up for it: it moved, it's off
 * (unpublished), or it was cancelled along with their sign-up.
 */
export type EventChange = "moved" | "off" | "cancelled";

const EVENT_CHANGE_KINDS: Record<EventChange, NewNotification["kind"]> = {
  moved: "eventMoved",
  off: "eventOff",
  cancelled: "eventCancelled",
};

/**
 * What an edit to an event is to the guests signed up for it: `off` when it was
 * unpublished, `moved` when its start or end changed while it stays on, `null`
 * for anything else (a new description, a price, held tables).
 */
export function eventChangeFor(
  before: Pick<CafeEvent, "isPublished" | "startsAt" | "endsAt">,
  after: Pick<CafeEvent, "isPublished" | "startsAt" | "endsAt">,
): Exclude<EventChange, "cancelled"> | null {
  if (before.isPublished && !after.isPublished) return "off";
  const sameTime = (a: string, b: string): boolean => new Date(a).getTime() === new Date(b).getTime();
  if (after.isPublished && (!sameTime(before.startsAt, after.startsAt) || !sameTime(before.endsAt, after.endsAt))) {
    return "moved";
  }
  return null;
}

/** The event's name in both languages, and when it is (or was) — the copy picks the guest's. */
function eventParams(event: CafeEvent): NewNotification["params"] {
  return { title: event.title, titleFa: event.titleFa ?? event.title, startsAt: event.startsAt };
}

/**
 * An event a guest signed up for changed. A move or an unpublish is keyed on the
 * save, so each is told once; a cancellation is keyed on the sign-up it ended,
 * which ends only once. An event that's off has no page to open, so it links to
 * the listing.
 */
export function eventChangeNotification(
  event: CafeEvent,
  registration: EventRegistration,
  change: EventChange,
): NewNotification {
  return {
    userId: normalizePhone(registration.guestPhone),
    kind: EVENT_CHANGE_KINDS[change],
    params: eventParams(event),
    link: change === "moved" ? `/events/${event.id}` : "/events",
    dedupeKey:
      change === "cancelled"
        ? `registration:${registration.id}:cancelled`
        : `event:${event.id}:${change}:${event.updatedAt}:${registration.id}`,
  };
}

/** Staff cancelled one guest's sign-up — the event itself is still on. */
export function registrationCancelledNotification(event: CafeEvent, registration: EventRegistration): NewNotification {
  return {
    userId: normalizePhone(registration.guestPhone),
    kind: "eventRegistrationCancelled",
    params: { ...eventParams(event), seats: registration.seats },
    link: `/events/${event.id}`,
    dedupeKey: `registration:${registration.id}:cancelled`,
  };
}
