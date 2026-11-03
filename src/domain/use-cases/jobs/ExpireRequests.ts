import { SYSTEM_ACTOR } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { isRequestUnanswered } from "../../entities/Reservation";
import { isStayRequestUnanswered } from "../../entities/SuiteBooking";
import { reservationExpiredNotification, suiteExpiredNotification } from "../notifications/guestNotifications";

import { forEachSettled } from "./forEachSettled";

import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IReservationRepository } from "../../repositories/IReservationRepository";
import type { ISuiteBookingRepository } from "../../repositories/ISuiteBookingRepository";

/** The start of time, for "every request up to now". */
const EPOCH = new Date(0);

/**
 * A table request nobody answered by the time it was for is cancelled as expired,
 * logged under the system actor, and the guest is told "we couldn't confirm your
 * request in time". Resolves to how many it cancelled. A request staff answer (or
 * move) in the meantime is left alone — the repository's write is guarded on it
 * still being an unanswered request.
 */
export class ExpireTableRequests {
  constructor(
    private readonly reservationRepo: Pick<IReservationRepository, "listBetween" | "expireRequest">,
    private readonly notifier: ICustomerNotifier,
  ) {}

  async execute(now: Date): Promise<number> {
    const requests = await this.reservationRepo.listBetween(EPOCH, new Date(now.getTime() + 1), "requested");
    let expired = 0;
    await forEachSettled(
      requests.filter((request) => isRequestUnanswered(request, now)),
      async (request) => {
        const saved = await this.reservationRepo.expireRequest(request.id, now, (result) => ({
          actorId: SYSTEM_ACTOR.id,
          actorName: SYSTEM_ACTOR.name,
          action: "reservation.expired",
          entityType: "reservation",
          entityId: result.id,
          entityLabel: `R-${result.reference}`,
          changes: [{ field: "status", before: request.status, after: result.status }],
        }));
        if (!saved) return;
        expired += 1;
        await this.notifier.notify(reservationExpiredNotification(saved));
      },
    );
    return expired;
  }
}

/**
 * A stay request nobody answered by the end of its arrival day is cancelled as
 * expired, the same way: logged under the system actor, the guest told.
 */
export class ExpireSuiteRequests {
  constructor(
    private readonly suiteRepo: Pick<ISuiteBookingRepository, "listRequestsArrivingBefore" | "expireRequest">,
    private readonly notifier: ICustomerNotifier,
  ) {}

  async execute(now: Date): Promise<number> {
    const today = cafeDayOf(now);
    const requests = await this.suiteRepo.listRequestsArrivingBefore(today);
    let expired = 0;
    await forEachSettled(
      requests.filter((request) => isStayRequestUnanswered(request, today)),
      async (request) => {
        const saved = await this.suiteRepo.expireRequest(request.id, today, now, (result) => ({
          actorId: SYSTEM_ACTOR.id,
          actorName: SYSTEM_ACTOR.name,
          action: "suiteBooking.expired",
          entityType: "suiteBooking",
          entityId: result.id,
          entityLabel: `S-${result.reference}`,
          changes: [{ field: "status", before: request.status, after: result.status }],
        }));
        if (!saved) return;
        expired += 1;
        await this.notifier.notify(suiteExpiredNotification(saved));
      },
    );
    return expired;
  }
}
