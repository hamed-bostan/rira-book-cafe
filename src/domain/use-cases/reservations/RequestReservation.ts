import { activityValue, type ActivityActor } from "../../entities/ActivityEntry";
import { isCafeTable } from "../../entities/CafeTable";
import { isPlausiblePhone } from "../../entities/Phone";
import {
  BOOKING_SLOT_MINUTES,
  DEFAULT_RESERVATION_MINUTES,
  MAX_BOOKING_DAYS_AHEAD,
  MAX_GUEST_NAME_LENGTH,
  MAX_PARTY_SIZE,
  MAX_RESERVATION_NOTE_LENGTH,
  MIN_PARTY_SIZE,
  type Reservation,
} from "../../entities/Reservation";
import { ValidationError } from "../../errors/ValidationError";

import type { User } from "../../entities/User";
import type { IReservationRepository } from "../../repositories/IReservationRepository";

export type RequestReservationInput = {
  /** UTC instant of the requested start. */
  startsAt: Date;
  partySize: number;
  note?: string;
};

/**
 * The booking rules both a guest and staff are held to: a quarter-hour start no
 * earlier than `earliest` and within the booking horizon, a party the floor can
 * seat, a short note. Returns the note trimmed (or dropped when blank).
 */
function validateBooking(input: RequestReservationInput, now: Date, earliest: Date): { note?: string } {
  const startsAt = input.startsAt;
  if (Number.isNaN(startsAt.getTime())) throw new ValidationError("startsAt", "Choose a date and time.");
  if (startsAt < earliest) throw new ValidationError("startsAt", "Choose a time in the future.");
  if (startsAt.getTime() - now.getTime() > MAX_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    throw new ValidationError("startsAt", `Bookings open ${MAX_BOOKING_DAYS_AHEAD} days ahead.`);
  }
  if (startsAt.getUTCMinutes() % BOOKING_SLOT_MINUTES !== 0 || startsAt.getUTCSeconds() !== 0) {
    throw new ValidationError("startsAt", `Choose a time on a ${BOOKING_SLOT_MINUTES}-minute mark.`);
  }
  if (!Number.isInteger(input.partySize) || input.partySize < MIN_PARTY_SIZE || input.partySize > MAX_PARTY_SIZE) {
    throw new ValidationError("partySize", `Party size must be ${MIN_PARTY_SIZE}–${MAX_PARTY_SIZE}.`);
  }
  const note = input.note?.trim() || undefined;
  if (note && note.length > MAX_RESERVATION_NOTE_LENGTH) throw new ValidationError("note", "That note is too long.");
  return { note };
}

/**
 * A signed-in guest asks for a table. The request is `requested` until staff
 * confirm it — the cafe, not the form, decides whether there's room, so there is
 * no automatic capacity check here (staff see the day and assign tables).
 */
export class RequestReservation {
  constructor(private readonly reservationRepo: IReservationRepository) {}

  async execute(
    input: RequestReservationInput,
    guest: Pick<User, "id" | "name" | "phone">,
    now: Date,
  ): Promise<Reservation> {
    // A guest books ahead: strictly after now.
    const { note } = validateBooking(input, now, new Date(now.getTime() + 1));

    return this.reservationRepo.create({
      userId: guest.id,
      guestName: guest.name,
      guestPhone: guest.phone,
      partySize: input.partySize,
      startsAt: input.startsAt.toISOString(),
      durationMinutes: DEFAULT_RESERVATION_MINUTES,
      note,
    });
  }
}

export type BookTableForGuestInput = RequestReservationInput & {
  guestName: string;
  guestPhone: string;
  /** A floor table to confirm it at now; omit to leave it a request. */
  tableLabel?: string;
};

/**
 * Staff book a table for a guest who rang or walked in — no account behind it.
 * With a table it's confirmed on the spot (the repository refuses a table a
 * booking or an event already has then); without one it waits as a request. A
 * walk-in may take the quarter hour that's already running.
 */
export class BookTableForGuest {
  constructor(private readonly reservationRepo: IReservationRepository) {}

  async execute(input: BookTableForGuestInput, actor: ActivityActor, now: Date): Promise<Reservation> {
    const { note } = validateBooking(input, now, new Date(now.getTime() - BOOKING_SLOT_MINUTES * 60 * 1000));
    const guestName = input.guestName.trim();
    if (!guestName) throw new ValidationError("guestName", "Enter the guest's name.");
    if (guestName.length > MAX_GUEST_NAME_LENGTH) throw new ValidationError("guestName", "That name is too long.");
    const guestPhone = input.guestPhone.trim();
    if (!isPlausiblePhone(guestPhone)) throw new ValidationError("guestPhone", "Enter a phone number.");
    if (input.tableLabel !== undefined && !isCafeTable(input.tableLabel)) {
      throw new ValidationError("tableLabel", `There's no table "${input.tableLabel}".`);
    }

    return this.reservationRepo.create(
      {
        guestName,
        guestPhone,
        partySize: input.partySize,
        startsAt: input.startsAt.toISOString(),
        durationMinutes: DEFAULT_RESERVATION_MINUTES,
        note,
        tableLabel: input.tableLabel,
      },
      (saved) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "reservation.booked",
        entityType: "reservation",
        entityId: saved.id,
        entityLabel: `R-${saved.reference}`,
        changes: [
          { field: "status", before: null, after: saved.status },
          ...(saved.tableLabel ? [{ field: "tableLabel", before: null, after: activityValue(saved.tableLabel) }] : []),
        ],
      }),
    );
  }
}
