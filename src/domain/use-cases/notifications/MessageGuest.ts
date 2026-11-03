import { MAX_GUEST_MESSAGE_LENGTH, type GuestMessageInput, type GuestMessageTopic } from "../../entities/GuestMessage";
import { isPlausiblePhone, normalizePhone } from "../../entities/Phone";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { staffMessageNotification } from "./guestNotifications";

import type { ActivityActor, NewActivityEntry } from "../../entities/ActivityEntry";
import type { Notification, NotificationParams } from "../../entities/Notification";
import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { IBookWaitlistRepository } from "../../repositories/IBookWaitlistRepository";
import type { IEventRepository } from "../../repositories/IEventRepository";
import type { INotificationRepository } from "../../repositories/INotificationRepository";
import type { IOrderRepository } from "../../repositories/IOrderRepository";
import type { IReservationRepository } from "../../repositories/IReservationRepository";
import type { ISuiteBookingRepository } from "../../repositories/ISuiteBookingRepository";

/** Where each kind of thing a message is about is read from. */
export type GuestMessageSources = {
  reservations: Pick<IReservationRepository, "getById">;
  suiteBookings: Pick<ISuiteBookingRepository, "getById">;
  events: Pick<IEventRepository, "getById" | "getRegistration">;
  bookLoans: Pick<IBookLoanRepository, "getById">;
  bookHolds: Pick<IBookWaitlistRepository, "getById">;
  orders: Pick<IOrderRepository, "getById">;
};

/** The thing a message is about, as the message and its activity entry need it. */
type Subject = {
  guestName: string;
  phone: string;
  /** The guest's account, when the record is linked to one. */
  userId?: string;
  /** How the guest's message names it, above the text. */
  about: NotificationParams;
  /** One of the guest's own pages that shows it — only for a record on their account. */
  link?: string;
  /** What the activity entry is about. */
  entry: Pick<NewActivityEntry, "action" | "entityType" | "entityId" | "entityLabel">;
};

/** `path` when the record is on the guest's account, so their page lists it. */
const ownPage = (userId: string | undefined, path: string): string | undefined => (userId ? path : undefined);

/**
 * Staff write to a guest about one of their bookings, loans, holds or orders. The
 * words go to the guest's messages on the site, addressed like every other notice
 * (their account, else their normalized phone), and the activity log records who
 * wrote what to whom, about what — in the same transaction.
 *
 * The phone staff saw beside the guest must still be the record's: a booking whose
 * guest changed since the page was drawn is refused (`GUEST_CHANGED`) rather than
 * messaging someone else. Who may write about each kind of thing is the route's
 * check (`GUEST_MESSAGE_PERMISSION`).
 */
export class MessageGuest {
  constructor(
    private readonly sources: GuestMessageSources,
    private readonly notificationRepo: Pick<INotificationRepository, "create">,
  ) {}

  async execute(input: GuestMessageInput, actor: ActivityActor): Promise<Notification> {
    const text = input.text.trim();
    if (!text) throw new ValidationError("text", "Write the message.");
    if (text.length > MAX_GUEST_MESSAGE_LENGTH) {
      throw new ValidationError("text", `Keep it to ${MAX_GUEST_MESSAGE_LENGTH} characters.`);
    }

    const subject = await this.subject(input.about.kind, input.about.id);
    if (!subject) throw new NotFoundError(input.about.kind, input.about.id);
    if (!isPlausiblePhone(subject.phone)) {
      throw new ValidationError("phone", "There's no phone number on this to send a message to.");
    }
    if (normalizePhone(input.phone) !== normalizePhone(subject.phone)) {
      throw new ConflictError("GUEST_CHANGED", "The guest's phone has changed since this page was loaded.");
    }

    const notification = staffMessageNotification(subject, text, subject.about, subject.link);
    if (!notification) throw new ValidationError("phone", "There's no phone number on this to send a message to.");

    const sent = await this.notificationRepo.create(notification, () => ({
      actorId: actor.id,
      actorName: actor.name,
      ...subject.entry,
      changes: [
        { field: "guest", before: null, after: `${subject.guestName} (${subject.phone})` },
        { field: "message", before: null, after: text },
      ],
    }));
    // Only a repeated dedupe key comes back empty, and a message has none.
    if (!sent) throw new Error("The message wasn't stored.");
    return sent;
  }

  private async subject(kind: GuestMessageTopic, id: string): Promise<Subject | null> {
    switch (kind) {
      case "reservation": {
        const reservation = await this.sources.reservations.getById(id);
        if (!reservation) return null;
        return {
          guestName: reservation.guestName,
          phone: reservation.guestPhone,
          userId: reservation.userId,
          about: { about: kind, reference: reservation.reference },
          link: ownPage(reservation.userId, "/reservations"),
          entry: {
            action: "reservation.guestMessaged",
            entityType: "reservation",
            entityId: reservation.id,
            entityLabel: `R-${reservation.reference}`,
          },
        };
      }
      case "suiteBooking": {
        const booking = await this.sources.suiteBookings.getById(id);
        if (!booking) return null;
        return {
          guestName: booking.guestName,
          phone: booking.guestPhone,
          userId: booking.userId,
          about: { about: kind, reference: booking.reference },
          link: ownPage(booking.userId, "/suite"),
          entry: {
            action: "suiteBooking.guestMessaged",
            entityType: "suiteBooking",
            entityId: booking.id,
            entityLabel: `S-${booking.reference}`,
          },
        };
      }
      case "eventRegistration": {
        const registration = await this.sources.events.getRegistration(id);
        const event = registration ? await this.sources.events.getById(registration.eventId) : null;
        if (!registration || !event) return null;
        return {
          guestName: registration.guestName,
          phone: registration.guestPhone,
          userId: registration.userId,
          about: { about: kind, subject: event.title, ...(event.titleFa ? { subjectFa: event.titleFa } : {}) },
          // The event's own page, which anyone can open while it's listed.
          link: event.isPublished ? `/events/${event.id}` : undefined,
          entry: { action: "event.guestMessaged", entityType: "event", entityId: event.id, entityLabel: event.title },
        };
      }
      case "bookLoan": {
        const loan = await this.sources.bookLoans.getById(id);
        if (!loan) return null;
        return {
          guestName: loan.borrowerName,
          phone: loan.borrowerPhone,
          userId: loan.userId,
          about: { about: kind, subject: loan.bookTitle },
          link: ownPage(loan.userId, "/loans"),
          entry: {
            action: "bookLoan.guestMessaged",
            entityType: "bookLoan",
            entityId: loan.id,
            entityLabel: `L-${loan.reference}`,
          },
        };
      }
      case "bookHold": {
        const hold = await this.sources.bookHolds.getById(id);
        if (!hold) return null;
        return {
          guestName: hold.guestName,
          phone: hold.guestPhone,
          userId: hold.userId,
          about: { about: kind, subject: hold.bookTitle },
          link: ownPage(hold.userId, "/loans"),
          // About the hold, as a skipped hold's entry is.
          entry: {
            action: "bookLoan.guestMessaged",
            entityType: "bookLoan",
            entityId: hold.id,
            entityLabel: `${hold.guestName} (${hold.bookTitle})`,
          },
        };
      }
      case "order": {
        const order = await this.sources.orders.getById(id);
        if (!order) return null;
        return {
          guestName: order.customerName,
          phone: order.customerPhone,
          userId: order.userId,
          about: { about: kind, reference: order.orderNumber },
          link: ownPage(order.userId, `/orders/${order.id}`),
          entry: {
            action: "order.customerNotified",
            entityType: "order",
            entityId: order.id,
            entityLabel: `#${order.orderNumber}`,
          },
        };
      }
    }
  }
}
