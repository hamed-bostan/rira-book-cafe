import { SYSTEM_ACTOR } from "../../entities/ActivityEntry";
import { isHoldPickupPassed } from "../../entities/BookWaitlist";
import { passCopyOn } from "../book-loans/BookWaitlist";
import { holdExpiredNotification } from "../notifications/guestNotifications";

import { forEachSettled } from "./forEachSettled";

import type { IBookWaitlistRepository } from "../../repositories/IBookWaitlistRepository";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";

/**
 * Guests told their book is back who didn't collect it by their deadline
 * (`HOLD_PICKUP_DAYS`) are skipped, as staff would: the hold is cancelled as
 * expired under the book's lending lock and logged under the system actor, the
 * guest is told "you didn't collect it in time", and the copy passes to the next
 * guest in line — the same `passCopyOn` a skip from the dashboard takes. Resolves
 * to how many it skipped.
 */
export class ExpireBookHolds {
  constructor(
    private readonly waitlistRepo: Pick<IBookWaitlistRepository, "listOpen" | "expireHold" | "notifyNext">,
    private readonly notifier: ICustomerNotifier,
  ) {}

  async execute(now: Date): Promise<number> {
    const passed = (await this.waitlistRepo.listOpen()).filter((entry) => isHoldPickupPassed(entry, now));
    let expired = 0;
    await forEachSettled(passed, async (entry) => {
      const skipped = await this.waitlistRepo.expireHold(entry.id, now, (result) => ({
        actorId: SYSTEM_ACTOR.id,
        actorName: SYSTEM_ACTOR.name,
        action: "bookLoan.holdExpired",
        entityType: "bookLoan",
        entityId: result.id,
        entityLabel: `${result.guestName} (${result.bookTitle})`,
        changes: [{ field: "status", before: entry.status, after: result.status }],
      }));
      if (!skipped) return;
      expired += 1;
      await this.notifier.notify(holdExpiredNotification(skipped));
      await passCopyOn(skipped, now, this.waitlistRepo, this.notifier);
    });
    return expired;
  }
}
