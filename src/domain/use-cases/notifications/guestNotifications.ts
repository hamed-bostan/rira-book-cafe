import { isBookLoanOverdue, type BookLoan } from "../../entities/BookLoan";
import {
  guestRecipient,
  LOAN_REMINDER_HOURS,
  type NewNotification,
  type NotificationParams,
} from "../../entities/Notification";
import { normalizePhone } from "../../entities/Phone";

import type { BookWaitlistEntry } from "../../entities/BookWaitlist";
import type { CafeEvent, EventRegistration } from "../../entities/CafeEvent";
import type { Order, OrderStatus } from "../../entities/Order";
import type { Reservation } from "../../entities/Reservation";
import type { SuiteBooking } from "../../entities/SuiteBooking";

/**
 * What each change tells the guest, as pure functions of the record after the
 * change — `null` when it isn't news to them. The use-cases decide *when* to send;
 * these decide *what*.
 *
 * Every notice is addressed by {@link guestRecipient}: the guest's account when
 * the record has one, else their normalized phone — so a guest who booked by
 * phone, borrowed at the counter or gave a number with a counter sale finds it in
 * their messages once they sign in with that number. The link is only kept for a
 * record on their account: the page it opens lists their own bookings, loans and
 * orders, and one made for them by phone isn't among those.
 */

/** Who the notice goes to and where tapping it leads — `null` when there's nobody to tell. */
function addressed(
  guest: { userId?: string; phone?: string },
  link: string,
): Pick<NewNotification, "userId" | "link"> | null {
  const userId = guestRecipient(guest);
  if (!userId) return null;
  return guest.userId ? { userId, link } : { userId };
}

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

/**
 * An order moved. A served order that earned points says so instead of a plain
 * "served". A counter sale is told by the phone it was rung up with; one with no
 * number has nobody to tell.
 */
export function orderStatusNotification(order: Order): NewNotification | null {
  if (order.status === "completed" && order.pointsEarned > 0 && order.userId) {
    return {
      userId: order.userId,
      kind: "pointsEarned",
      params: { orderNumber: order.orderNumber, points: order.pointsEarned },
      link: "/rewards",
      dedupeKey: `order:${order.id}:pointsEarned`,
    };
  }
  const kind = ORDER_KINDS[order.status];
  const to = kind ? addressed({ userId: order.userId, phone: order.customerPhone }, `/orders/${order.id}`) : null;
  if (!kind || !to) return null;
  return {
    ...to,
    kind,
    params: { orderNumber: order.orderNumber, serviceType: order.serviceType },
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
  const to = kind ? addressed({ userId: reservation.userId, phone: reservation.guestPhone }, "/reservations") : null;
  if (!kind || !to) return null;
  return {
    ...to,
    kind,
    params: {
      reference: reservation.reference,
      startsAt: reservation.startsAt,
      partySize: reservation.partySize,
      ...(reservation.tableLabel ? { tableLabel: reservation.tableLabel } : {}),
    },
    dedupeKey: `reservation:${reservation.id}:${reservation.status}`,
  };
}

/** Staff confirmed or cancelled a suite stay. */
export function suiteNotification(booking: SuiteBooking): NewNotification | null {
  const kind =
    booking.status === "confirmed" ? "suiteConfirmed" : booking.status === "cancelled" ? "suiteCancelled" : null;
  const to = kind ? addressed({ userId: booking.userId, phone: booking.guestPhone }, "/suite") : null;
  if (!kind || !to) return null;
  return {
    ...to,
    kind,
    params: { reference: booking.reference, checkIn: booking.checkIn, checkOut: booking.checkOut },
    dedupeKey: `suite:${booking.id}:${booking.status}`,
  };
}

/** A book went home with a guest: the loan, and when it's due. */
export function loanStartedNotification(loan: BookLoan): NewNotification | null {
  const to = addressed({ userId: loan.userId, phone: loan.borrowerPhone }, "/loans");
  if (!to) return null;
  return {
    ...to,
    kind: "loanStarted",
    params: { title: loan.bookTitle, dueAt: loan.dueAt },
    dedupeKey: `loan:${loan.id}:started`,
  };
}

/**
 * The reminder a borrowed book is due for at `now`, if any: overdue once it's past
 * due, "due soon" within {@link LOAN_REMINDER_HOURS} of it. Each is keyed per loan,
 * so working this out every time the guest looks sends each reminder once.
 */
export function loanReminder(loan: BookLoan, now: Date): NewNotification | null {
  if (loan.status !== "out") return null;
  const overdue = isBookLoanOverdue(loan, now);
  const dueSoon = new Date(loan.dueAt).getTime() - now.getTime() <= LOAN_REMINDER_HOURS * 60 * 60 * 1000;
  const to = addressed({ userId: loan.userId, phone: loan.borrowerPhone }, "/loans");
  if ((!overdue && !dueSoon) || !to) return null;
  const kind = overdue ? "loanOverdue" : "loanDueSoon";
  return {
    ...to,
    kind,
    params: { title: loan.bookTitle, dueAt: loan.dueAt },
    dedupeKey: `loan:${loan.id}:${kind}`,
  };
}

/** A copy is free for the guest at the front of a book's line: it's theirs to collect. */
export function bookAvailableNotification(entry: BookWaitlistEntry): NewNotification | null {
  const to = addressed({ userId: entry.userId, phone: entry.guestPhone }, "/loans");
  if (!to) return null;
  return {
    ...to,
    kind: "bookAvailable",
    params: { title: entry.bookTitle },
    dedupeKey: `waitlist:${entry.id}:available`,
  };
}

/**
 * Words staff wrote to a guest, about one thing of theirs (`about` names what, for
 * the line above the text). Never deduplicated: two messages are two messages.
 */
export function staffMessageNotification(
  guest: { userId?: string; phone: string },
  text: string,
  about: NotificationParams,
  link: string | undefined,
): NewNotification | null {
  const userId = guestRecipient(guest);
  if (!userId) return null;
  return { userId, kind: "staffMessage", params: { ...about, text }, ...(link ? { link } : {}) };
}

/**
 * Staff moved a table booking, or changed how many it's for or how long it holds
 * the table: the booking as it is now. Addressed like every booking notice, so a
 * phone or walk-in guest finds it once they sign in with that number; keyed on
 * the save, so each change is told once.
 */
export function reservationChangedNotification(reservation: Reservation): NewNotification | null {
  const to = addressed({ userId: reservation.userId, phone: reservation.guestPhone }, "/reservations");
  if (!to) return null;
  return {
    ...to,
    kind: "reservationChanged",
    params: {
      reference: reservation.reference,
      startsAt: reservation.startsAt,
      partySize: reservation.partySize,
      durationMinutes: reservation.durationMinutes,
    },
    dedupeKey: `reservation:${reservation.id}:changed:${reservation.updatedAt}`,
  };
}

/** Staff changed a suite stay's days or party: the stay as it is now, told once per change. */
export function suiteChangedNotification(booking: SuiteBooking): NewNotification | null {
  const to = addressed({ userId: booking.userId, phone: booking.guestPhone }, "/suite");
  if (!to) return null;
  return {
    ...to,
    kind: "suiteChanged",
    params: {
      reference: booking.reference,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
    },
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
