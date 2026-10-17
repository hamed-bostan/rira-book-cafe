import { activityValue, type ActivityActor, type ActivityChange } from "../../entities/ActivityEntry";
import {
  MAX_TABLE_LABEL_LENGTH,
  canTransitionReservation,
  isGuestCancellableReservation,
  type Reservation,
  type ReservationStatus,
} from "../../entities/Reservation";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { reservationNotification } from "../notifications/guestNotifications";

import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IReservationRepository } from "../../repositories/IReservationRepository";

export type ReservationUpdate = {
  /** The new status; omit to keep the current one (e.g. only moving the table). */
  status?: ReservationStatus;
  /** The table to hold; `null` clears it; omit to keep it. */
  tableLabel?: string | null;
};

/**
 * Staff act on a reservation: confirm (with a table), seat, complete, mark a
 * no-show, cancel — or just move it to another table. The workflow table in
 * `Reservation.ts` is the whole rule; the repository refuses a table another
 * overlapping booking already holds.
 */
export class ChangeReservation {
  constructor(
    private readonly reservationRepo: IReservationRepository,
    /** Tells the guest their table was confirmed or cancelled. */
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(id: string, update: ReservationUpdate, actor: ActivityActor): Promise<Reservation> {
    const current = await this.reservationRepo.getById(id);
    if (!current) throw new NotFoundError("reservation", id);

    const status = update.status ?? current.status;
    if (status !== current.status && !canTransitionReservation(current.status, status)) {
      throw new ConflictError("INVALID_TRANSITION", `A reservation can't move from "${current.status}" to "${status}".`);
    }

    // A finished booking keeps its table as history; only bookings that hold a
    // table (`TABLE_HOLDING_STATUSES`) are checked for clashes by the repository.
    const tableLabel = update.tableLabel === undefined ? (current.tableLabel ?? null) : update.tableLabel?.trim() || null;
    if (tableLabel && tableLabel.length > MAX_TABLE_LABEL_LENGTH) {
      throw new ValidationError("tableLabel", "That table label is too long.");
    }
    if (status === "seated" && !tableLabel) {
      throw new ValidationError("tableLabel", "Choose the table the party is seated at.");
    }
    if (status === current.status && tableLabel === (current.tableLabel ?? null)) return current;

    const saved = await this.reservationRepo.applyChange(id, current.status, { status, tableLabel }, actor, (saved) => {
      const changes: ActivityChange[] = [];
      if (saved.status !== current.status) {
        changes.push({ field: "status", before: current.status, after: saved.status });
      }
      if ((saved.tableLabel ?? null) !== (current.tableLabel ?? null)) {
        changes.push({ field: "tableLabel", before: activityValue(current.tableLabel), after: activityValue(saved.tableLabel) });
      }
      return {
        actorId: actor.id,
        actorName: actor.name,
        action: "reservation.changed",
        entityType: "reservation",
        entityId: saved.id,
        entityLabel: `R-${saved.reference}`,
        changes,
      };
    });

    if (saved.status !== current.status && this.notifier) {
      const notification = reservationNotification(saved);
      if (notification) await this.notifier.notify(notification);
    }
    return saved;
  }
}

/**
 * A guest withdrawing their own booking — while it's requested or confirmed and
 * hasn't started. Someone else's booking reads as not found.
 */
export class CancelOwnReservation {
  constructor(private readonly reservationRepo: IReservationRepository) {}

  async execute(id: string, guest: ActivityActor, now: Date): Promise<Reservation> {
    const current = await this.reservationRepo.getById(id);
    if (current?.userId !== guest.id) throw new NotFoundError("reservation", id);
    if (!isGuestCancellableReservation(current, now)) {
      throw new ConflictError("INVALID_TRANSITION", "This reservation can no longer be cancelled online.");
    }
    return this.reservationRepo.applyChange(id, current.status, { status: "cancelled" }, guest);
  }
}
