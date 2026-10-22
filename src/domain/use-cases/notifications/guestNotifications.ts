import { isBookLoanOverdue, type BookLoan } from "../../entities/BookLoan";
import { LOAN_REMINDER_HOURS, type NewNotification } from "../../entities/Notification";

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
