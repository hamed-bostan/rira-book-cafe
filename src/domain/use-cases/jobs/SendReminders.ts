import { cafeDayOf } from "../../entities/CafeTime";
import {
  dueEventReminder,
  dueHoldReminder,
  dueLoanReminder,
  dueReservationReminders,
  dueSuiteReminder,
} from "../notifications/guestNotifications";

import type { NewNotification } from "../../entities/Notification";
import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { IBookWaitlistRepository } from "../../repositories/IBookWaitlistRepository";
import type { IEventRepository } from "../../repositories/IEventRepository";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IReservationRepository } from "../../repositories/IReservationRepository";
import type { ISuiteBookingRepository } from "../../repositories/ISuiteBookingRepository";

/**
 * The reminder jobs. Each reads what's coming up, works out which reminders are due
 * now (`guestNotifications`: the evening before, two hours before, a book due
 * tomorrow …) and sends them. Every reminder is keyed, so a run repeated a minute
 * later — or on a second server — sends nothing new. Each resolves to how many
 * reminders were due, sent now or earlier.
 */

/**
 * How far ahead the reminders look: past the evening before the last thing
 * happening tomorrow, whatever the hour.
 */
const LOOKAHEAD_MS = 2 * 24 * 60 * 60 * 1000;

async function send(notifier: ICustomerNotifier, due: readonly NewNotification[]): Promise<number> {
  for (const notification of due) await notifier.notify(notification);
  return due.length;
}

/** Confirmed tables: the evening before, and about two hours before. */
export class SendTableReminders {
  constructor(
    private readonly reservationRepo: Pick<IReservationRepository, "listBetween">,
    private readonly notifier: ICustomerNotifier,
  ) {}

  async execute(now: Date): Promise<number> {
    const upcoming = await this.reservationRepo.listBetween(now, new Date(now.getTime() + LOOKAHEAD_MS), "confirmed");
    return send(
      this.notifier,
      upcoming.flatMap((reservation) => dueReservationReminders(reservation, now)),
    );
  }
}

/** Confirmed suite stays: the evening before the arrival day. */
export class SendSuiteReminders {
  constructor(
    private readonly suiteRepo: Pick<ISuiteBookingRepository, "listFrom">,
    private readonly notifier: ICustomerNotifier,
  ) {}

  async execute(now: Date): Promise<number> {
    const stays = await this.suiteRepo.listFrom(cafeDayOf(now), "confirmed");
    return send(
      this.notifier,
      stays.flatMap((booking) => dueSuiteReminder(booking, now) ?? []),
    );
  }
}

/** Event sign-ups: the evening before the event. */
export class SendEventReminders {
  constructor(
    private readonly eventRepo: Pick<IEventRepository, "listUpcomingPublished" | "listRegistrations">,
    private readonly notifier: ICustomerNotifier,
  ) {}

  async execute(now: Date): Promise<number> {
    const soon = (await this.eventRepo.listUpcomingPublished(now)).filter(
      (event) => new Date(event.startsAt).getTime() - now.getTime() < LOOKAHEAD_MS,
    );
    let due = 0;
    for (const event of soon) {
      const registrations = await this.eventRepo.listRegistrations(event.id);
      due += await send(
        this.notifier,
        registrations.flatMap((registration) => dueEventReminder(event, registration, now) ?? []),
      );
    }
    return due;
  }
}

/**
 * Borrowed books: due tomorrow, and overdue — for every borrower, a phone-only one
 * too. A guest with an account may already have had one from their inbox working
 * it out when they looked; the shared key makes this send nothing then.
 */
export class SendLoanReminders {
  constructor(
    private readonly loanRepo: Pick<IBookLoanRepository, "listOutDueBefore">,
    private readonly notifier: ICustomerNotifier,
  ) {}

  async execute(now: Date): Promise<number> {
    const loans = await this.loanRepo.listOutDueBefore(new Date(now.getTime() + LOOKAHEAD_MS));
    return send(
      this.notifier,
      loans.flatMap((loan) => dueLoanReminder(loan, now) ?? []),
    );
  }
}

/** Guests told their book is back: "collect it by …", then "last day to collect". */
export class SendHoldReminders {
  constructor(
    private readonly waitlistRepo: Pick<IBookWaitlistRepository, "listOpen">,
    private readonly notifier: ICustomerNotifier,
  ) {}

  async execute(now: Date): Promise<number> {
    const open = await this.waitlistRepo.listOpen();
    return send(
      this.notifier,
      open.flatMap((entry) => dueHoldReminder(entry, now) ?? []),
    );
  }
}
