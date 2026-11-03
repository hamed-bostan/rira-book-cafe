import { NOTIFICATION_LIST_LIMIT, type Notification } from "../../entities/Notification";

import { loanReminder } from "./guestNotifications";

import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { ICustomerNotifier, INotificationRepository } from "../../repositories/INotificationRepository";

/**
 * Send the guest any loan reminders that have come due. The background jobs send
 * them on the clock (`dueLoanReminder`); this works them out again whenever the
 * guest's notifications are read (the list, the unread badge), so one that's due
 * shows at once. Both use the same keys, so each is only ever sent once.
 */
export class SyncLoanReminders {
  constructor(
    private readonly loanRepo: Pick<IBookLoanRepository, "listForUser">,
    private readonly notifier: ICustomerNotifier,
  ) {}

  async execute(userId: string, now: Date): Promise<void> {
    const loans = await this.loanRepo.listForUser(userId);
    for (const loan of loans) {
      const reminder = loanReminder(loan, now);
      if (reminder) await this.notifier.notify(reminder);
    }
  }
}

/** The guest's notifications, newest first, with any due loan reminders added first. */
export class ListNotifications {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly reminders: SyncLoanReminders,
  ) {}

  async execute(userId: string, now: Date): Promise<Notification[]> {
    await this.reminders.execute(userId, now);
    return this.notificationRepo.listForUser(userId, NOTIFICATION_LIST_LIMIT);
  }
}

/** How many the guest hasn't read — the badge on the bell. */
export class CountUnreadNotifications {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly reminders: SyncLoanReminders,
  ) {}

  async execute(userId: string, now: Date): Promise<number> {
    await this.reminders.execute(userId, now);
    return this.notificationRepo.countUnread(userId);
  }
}

/** The guest opened their notifications: everything there is now read. */
export class MarkNotificationsRead {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  execute(userId: string, now: Date): Promise<void> {
    return this.notificationRepo.markAllRead(userId, now);
  }
}
