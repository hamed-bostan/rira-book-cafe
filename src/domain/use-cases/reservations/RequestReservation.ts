import {
  BOOKING_SLOT_MINUTES,
  DEFAULT_RESERVATION_MINUTES,
  MAX_BOOKING_DAYS_AHEAD,
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
    const startsAt = input.startsAt;
    if (Number.isNaN(startsAt.getTime())) throw new ValidationError("startsAt", "Choose a date and time.");
    if (startsAt <= now) throw new ValidationError("startsAt", "Choose a time in the future.");
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

    return this.reservationRepo.create({
      userId: guest.id,
      guestName: guest.name,
      guestPhone: guest.phone,
      partySize: input.partySize,
      startsAt: startsAt.toISOString(),
      durationMinutes: DEFAULT_RESERVATION_MINUTES,
      note,
    });
  }
}
