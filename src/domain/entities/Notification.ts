import { isPlausiblePhone, normalizePhone } from "./Phone";

/**
 * A message to one guest, shown on their account page and behind the bell in the
 * header — there's no SMS. Something happened that's about them: their order is
 * ready, a booking was confirmed, a borrowed book is due back — or staff wrote to
 * them about one of those.
 *
 * Only the facts are stored (`kind` + `params`); the copy is written in the
 * guest's language when it's shown, so a notification reads right after they
 * switch language and the wording can change without touching old rows.
 */

export const NOTIFICATION_KINDS = [
  "orderAccepted",
  "orderReady",
  "orderCompleted",
  "orderCancelled",
  "reservationConfirmed",
  "reservationCancelled",
  "suiteConfirmed",
  "suiteCancelled",
  "loanStarted",
  "loanDueSoon",
  "loanOverdue",
  "bookAvailable",
  "pointsEarned",
  "reviewApproved",
  // Words a member of staff wrote to the guest about one of their bookings, loans or orders.
  "staffMessage",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** The values a message is filled with — numbers, names, ISO timestamps. */
export type NotificationParams = Record<string, string | number>;

export type Notification = {
  id: string;
  /** Who it's for: the guest's account id, which is their normalized phone — see {@link guestRecipient}. */
  userId: string;
  kind: NotificationKind;
  params: NotificationParams;
  /** A site path tapping it opens, e.g. `/orders/…`. */
  link?: string;
  /** ISO 8601 (UTC); absent while unread. */
  readAt?: string;
  createdAt: string;
};

/**
 * A notification about to be sent. `dedupeKey` makes it at-most-once: a second
 * notification with the same key is quietly dropped (a loan's due-soon reminder is
 * worked out each time the guest looks, and must only be sent the first time).
 */
export type NewNotification = Omit<Notification, "id" | "readAt" | "createdAt"> & { dedupeKey?: string };

/** How many notifications a guest's list shows — recent history, not an archive. */
export const NOTIFICATION_LIST_LIMIT = 50;

/** How close to its due day a borrowed book gets a reminder. */
export const LOAN_REMINDER_HOURS = 48;

/**
 * Who a notice to a guest goes to: their account when the record is linked to one,
 * else the phone they gave, normalized. A user's id *is* their normalized phone, so
 * a notice addressed to the number is waiting in their profile from the first time
 * they sign in with it — a guest who booked by phone or at the counter is told
 * like any other. `null` only when there's no number to go by (a walk-in who gave
 * none).
 */
export function guestRecipient(guest: { userId?: string; phone?: string }): string | null {
  if (guest.userId) return guest.userId;
  if (!guest.phone || !isPlausiblePhone(guest.phone)) return null;
  return normalizePhone(guest.phone);
}
