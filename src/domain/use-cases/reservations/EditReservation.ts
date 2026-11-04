import { activityValue, type ActivityActor, type ActivityChange } from "../../entities/ActivityEntry";
import { isFloorTable } from "../../entities/CafeTable";
import {
  RESCHEDULE_DETAILS,
  RESERVATION_DETAILS,
  RESERVATION_LENGTHS,
  editableReservationDetails,
  type Reservation,
  type ReservationDetail,
} from "../../entities/Reservation";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { reservationChangedNotification } from "../notifications/guestNotifications";
import { readFloor } from "../settings/CafeTableCommands";

import { staffEarliestStart, validateBookingNote, validateBookingStart, validatePartySize } from "./RequestReservation";

import type { ICafeTableRepository } from "../../repositories/ICafeTableRepository";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IReservationRepository, ReservationEdit } from "../../repositories/IReservationRepository";

/** What staff send from the "Edit booking" dialog. A detail left out keeps its value. */
export type ReservationDetailsInput = {
  /** UTC instant of the new start. */
  startsAt?: Date;
  partySize?: number;
  /** Minutes, one of `RESERVATION_LENGTHS`. */
  durationMinutes?: number;
  /** Blank clears it. */
  note?: string;
  /** A table from the floor plan; `null` clears it. */
  tableLabel?: string | null;
};

/** A booking's details as the repository saves them. */
function detailsOf(reservation: Reservation): ReservationEdit {
  return {
    startsAt: reservation.startsAt,
    partySize: reservation.partySize,
    durationMinutes: reservation.durationMinutes,
    note: reservation.note ?? null,
    tableLabel: reservation.tableLabel ?? null,
  };
}

/** Whether a detail differs between two sets — instants compared as instants. */
function differs(detail: ReservationDetail, before: ReservationEdit, after: ReservationEdit): boolean {
  if (detail === "startsAt") return new Date(before.startsAt).getTime() !== new Date(after.startsAt).getTime();
  return before[detail] !== after[detail];
}

/**
 * Staff edit a booking: move it to another day or time, change the party, how
 * long it holds the table, the note, or the table. Not the guest — a booking's
 * guest is its profile. `editableReservationDetails` is the whole rule for what
 * may change in which status (only the length and the table once the party is
 * seated). A new time is held to the booking rules — a quarter
 * hour, not in the past, within the horizon — and the repository re-checks the
 * table at the new time and length under its lock, refusing a clash as a new
 * booking would. A move, or a new party or length, tells the guest.
 */
export class EditReservation {
  constructor(
    private readonly reservationRepo: IReservationRepository,
    /** The floor a newly given table must be on. */
    private readonly tables: Pick<ICafeTableRepository, "listAll">,
    /** Tells the guest their booking was changed. */
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(id: string, input: ReservationDetailsInput, actor: ActivityActor, now: Date): Promise<Reservation> {
    const current = await this.reservationRepo.getById(id);
    if (!current) throw new NotFoundError("reservation", id);
    const editable = editableReservationDetails(current);
    if (editable.length === 0) {
      throw new ConflictError("INVALID_TRANSITION", `A ${current.status} reservation can't be changed.`);
    }

    const before = detailsOf(current);
    const startsAt = input.startsAt ?? new Date(current.startsAt);
    const next: ReservationEdit = {
      // An invalid date can't be turned into an ISO string; it's refused below as a changed start.
      startsAt: Number.isNaN(startsAt.getTime()) ? "" : startsAt.toISOString(),
      partySize: input.partySize ?? current.partySize,
      durationMinutes: input.durationMinutes ?? current.durationMinutes,
      note: input.note === undefined ? before.note : (validateBookingNote(input.note) ?? null),
      tableLabel: input.tableLabel === undefined ? before.tableLabel : input.tableLabel?.trim() || null,
    };

    const changed = RESERVATION_DETAILS.filter((detail) => differs(detail, before, next));
    if (changed.length === 0) return current;

    const locked = changed.find((detail) => !editable.includes(detail));
    if (locked) {
      throw new ValidationError(locked, "Once the party is seated, only the length and the table can change.");
    }

    if (changed.includes("startsAt")) validateBookingStart(startsAt, now, staffEarliestStart(now));
    if (changed.includes("partySize")) validatePartySize(next.partySize);
    if (
      changed.includes("durationMinutes") &&
      !(RESERVATION_LENGTHS as readonly number[]).includes(next.durationMinutes)
    ) {
      throw new ValidationError("durationMinutes", "Choose how long the table is held.");
    }
    if (
      changed.includes("tableLabel") &&
      next.tableLabel &&
      !isFloorTable(await readFloor(this.tables), next.tableLabel)
    ) {
      throw new ValidationError("tableLabel", `There's no table "${next.tableLabel}".`);
    }
    if (current.status === "seated" && changed.includes("tableLabel") && !next.tableLabel) {
      throw new ValidationError("tableLabel", "Choose the table the party is seated at.");
    }

    const saved = await this.reservationRepo.applyEdit(id, current.status, next, (saved) => {
      const after = detailsOf(saved);
      const changes: ActivityChange[] = changed.map((detail) => ({
        field: detail,
        before: activityValue(before[detail]),
        after: activityValue(after[detail]),
      }));
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

    const notification = changed.some((detail) => (RESCHEDULE_DETAILS as readonly string[]).includes(detail))
      ? reservationChangedNotification(saved)
      : null;
    if (notification && this.notifier) await this.notifier.notify(notification);
    return saved;
  }
}
