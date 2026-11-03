import type { Permission } from "./Permission";

/**
 * Staff writing to a guest: a few lines of plain text, sent to the guest's
 * messages on the site (there's no SMS) as a `staffMessage` notification. Every
 * message is about one thing the guest has with the cafe — a booking, a loan, a
 * hold, an order — which names the guest, holds their phone, and decides who on
 * the team may write. Guests read them; they can't reply in the app.
 */

/** What a message can be about. */
export const GUEST_MESSAGE_TOPICS = [
  "reservation",
  "suiteBooking",
  "eventRegistration",
  "bookLoan",
  "bookHold",
  "order",
] as const;
export type GuestMessageTopic = (typeof GUEST_MESSAGE_TOPICS)[number];

/** The longest message: a few sentences, not a letter. */
export const MAX_GUEST_MESSAGE_LENGTH = 500;

/** Who may write to a guest about each: whoever manages that thing. */
export const GUEST_MESSAGE_PERMISSION: Readonly<Record<GuestMessageTopic, Permission>> = {
  reservation: "reservations.manage",
  suiteBooking: "reservations.manage",
  eventRegistration: "events.manage",
  bookLoan: "loans.manage",
  bookHold: "loans.manage",
  order: "orders.fulfill",
};

/** A message about to be sent: the phone staff see beside the guest, the words, and what it's about. */
export type GuestMessageInput = {
  phone: string;
  text: string;
  about: { kind: GuestMessageTopic; id: string };
};
