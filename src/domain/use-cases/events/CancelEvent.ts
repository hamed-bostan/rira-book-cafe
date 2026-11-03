import { activityValue, type ActivityActor, type ActivityChange } from "../../entities/ActivityEntry";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { eventChangeNotification } from "../notifications/guestNotifications";

import type { CafeEvent } from "../../entities/CafeEvent";
import type { IEventRepository } from "../../repositories/IEventRepository";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";

/**
 * Staff call an event off: every sign-up is cancelled, the event comes off the
 * site, and each guest who was signed up is told — one step, where cancelling
 * sign-ups one by one used to come first (an event with guests can't be deleted).
 * Only an event that hasn't ended can be called off. Paid sign-ups keep what they
 * paid on record, shown as owed back, as when one sign-up is cancelled.
 */
export class CancelEvent {
  constructor(
    private readonly eventRepo: IEventRepository,
    /** Tells each guest signed up that the event is off. */
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(id: string, actor: ActivityActor, now: Date): Promise<CafeEvent> {
    const existing = await this.eventRepo.getById(id);
    if (!existing) throw new NotFoundError("event", id);
    if (new Date(existing.endsAt) <= now) {
      throw new ConflictError("EVENT_CLOSED", "This event is over, so it can't be called off.");
    }

    const { event, cancelled } = await this.eventRepo.cancelEvent(id, ({ event, cancelled }) => {
      const changes: ActivityChange[] = [
        ...(existing.isPublished !== event.isPublished
          ? [
              {
                field: "isPublished",
                before: activityValue(existing.isPublished),
                after: activityValue(event.isPublished),
              },
            ]
          : []),
        ...(cancelled.length > 0
          ? [
              {
                field: "registrations",
                before: activityValue(
                  cancelled.map((registration) => `${registration.guestName} (${registration.seats})`).join(", "),
                ),
                after: null,
              },
            ]
          : []),
      ];
      return {
        actorId: actor.id,
        actorName: actor.name,
        action: "event.cancelled",
        entityType: "event",
        entityId: event.id,
        entityLabel: event.title,
        changes,
      };
    });

    if (this.notifier) {
      for (const registration of cancelled) {
        await this.notifier.notify(eventChangeNotification(event, registration, "cancelled"));
      }
    }
    return event;
  }
}
