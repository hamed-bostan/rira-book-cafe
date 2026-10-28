import { cafeDayOf } from "../../entities/CafeTime";
import {
  canTransitionSuiteBooking,
  canUndoSuiteBookingStatus,
  isGuestCancellableSuiteBooking,
  type SuiteBooking,
  type SuiteBookingStatus,
} from "../../entities/SuiteBooking";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { suiteNotification } from "../notifications/guestNotifications";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { ISuiteBookingRepository } from "../../repositories/ISuiteBookingRepository";

/**
 * Staff act on a stay: confirm, check in, check out, cancel, or mark a no-show —
 * and take back a Check in from its toast. The workflow table in `SuiteBooking.ts`
 * is the whole rule, with `canUndoSuiteBookingStatus` its one way back; the
 * repository refuses to confirm nights another stay already holds.
 */
export class ChangeSuiteBooking {
  constructor(
    private readonly suiteRepo: ISuiteBookingRepository,
    /** Tells the guest their stay was confirmed or cancelled. */
    private readonly notifier?: ICustomerNotifier,
  ) {}

  /**
   * `undo` takes back a Check in from its toast (`canUndoSuiteBookingStatus`)
   * instead of moving the workflow on, and tells the guest nothing.
   */
  async execute(
    id: string,
    status: SuiteBookingStatus,
    staff: ActivityActor,
    { undo = false }: { undo?: boolean } = {},
  ): Promise<SuiteBooking> {
    const current = await this.suiteRepo.getById(id);
    if (!current) throw new NotFoundError("suite booking", id);
    if (undo) {
      if (!canUndoSuiteBookingStatus(current.status, status)) {
        throw new ConflictError(
          "INVALID_TRANSITION",
          `A suite booking can't go back from "${current.status}" to "${status}".`,
        );
      }
    } else {
      if (status === current.status) return current;
      if (!canTransitionSuiteBooking(current.status, status)) {
        throw new ConflictError(
          "INVALID_TRANSITION",
          `A suite booking can't move from "${current.status}" to "${status}".`,
        );
      }
    }

    const saved = await this.suiteRepo.applyStatus(id, current.status, status, (saved) => ({
      actorId: staff.id,
      actorName: staff.name,
      action: "suiteBooking.changed",
      entityType: "suiteBooking",
      entityId: saved.id,
      entityLabel: `S-${saved.reference}`,
      changes: [{ field: "status", before: current.status, after: saved.status }],
    }));

    // An undo isn't news to the guest: stepping back to `confirmed` mustn't tell them again.
    const notification = undo ? null : suiteNotification(saved);
    if (notification && this.notifier) await this.notifier.notify(notification);
    return saved;
  }
}

/**
 * A guest withdrawing their own stay — while it's requested or confirmed and the
 * check-in day hasn't come. Someone else's booking reads as not found.
 */
export class CancelOwnSuiteBooking {
  constructor(private readonly suiteRepo: ISuiteBookingRepository) {}

  async execute(id: string, guestId: string, now: Date): Promise<SuiteBooking> {
    const current = await this.suiteRepo.getById(id);
    if (current?.userId !== guestId) throw new NotFoundError("suite booking", id);
    if (!isGuestCancellableSuiteBooking(current, cafeDayOf(now))) {
      throw new ConflictError("INVALID_TRANSITION", "This stay can no longer be cancelled online.");
    }
    return this.suiteRepo.applyStatus(id, current.status, "cancelled");
  }
}
