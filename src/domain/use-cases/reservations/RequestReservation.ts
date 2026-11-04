import { activityValue, type ActivityActor } from "../../entities/ActivityEntry";
import { isFloorTable } from "../../entities/CafeTable";
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
import { ResolveGuestProfile } from "../guest-profiles/ResolveGuestProfile";
import { readFloor } from "../settings/CafeTableCommands";

import type { User } from "../../entities/User";
import type { ICafeTableRepository } from "../../repositories/ICafeTableRepository";
import type { IReservationRepository } from "../../repositories/IReservationRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

export type RequestReservationInput = {
  /** UTC instant of the requested start. */
  startsAt: Date;
  partySize: number;
  note?: string;
};

/**
 * When a booking may start: a quarter-hour mark no earlier than `earliest` and
 * within the booking horizon. Any time of day will do.
 */
export function validateBookingStart(startsAt: Date, now: Date, earliest: Date): void {
  if (Number.isNaN(startsAt.getTime())) throw new ValidationError("startsAt", "Choose a date and time.");
  if (startsAt < earliest) throw new ValidationError("startsAt", "Choose a time in the future.");
  if (startsAt.getTime() - now.getTime() > MAX_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    throw new ValidationError("startsAt", `Bookings open ${MAX_BOOKING_DAYS_AHEAD} days ahead.`);
  }
  if (startsAt.getUTCMinutes() % BOOKING_SLOT_MINUTES !== 0 || startsAt.getUTCSeconds() !== 0) {
    throw new ValidationError("startsAt", `Choose a time on a ${BOOKING_SLOT_MINUTES}-minute mark.`);
  }
}

/** The earliest staff may book or move a table to: the quarter hour already running, for a walk-in. */
export function staffEarliestStart(now: Date): Date {
  return new Date(now.getTime() - BOOKING_SLOT_MINUTES * 60 * 1000);
}

/** A party the floor can seat. */
export function validatePartySize(partySize: number): void {
  if (!Number.isInteger(partySize) || partySize < MIN_PARTY_SIZE || partySize > MAX_PARTY_SIZE) {
    throw new ValidationError("partySize", `Party size must be ${MIN_PARTY_SIZE}–${MAX_PARTY_SIZE}.`);
  }
}

/** A short note, trimmed — or dropped when blank. */
export function validateBookingNote(note: string | undefined): string | undefined {
  const trimmed = note?.trim() || undefined;
  if (trimmed && trimmed.length > MAX_RESERVATION_NOTE_LENGTH) {
    throw new ValidationError("note", "That note is too long.");
  }
  return trimmed;
}

/**
 * The booking rules both a guest and staff are held to: a quarter-hour start no
 * earlier than `earliest` and within the booking horizon, a party the floor can
 * seat, a short note. Returns the note trimmed (or dropped when blank).
 */
function validateBooking(input: RequestReservationInput, now: Date, earliest: Date): { note?: string } {
  validateBookingStart(input.startsAt, now, earliest);
  validatePartySize(input.partySize);
  return { note: validateBookingNote(input.note) };
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
  /** The guest's phone, which finds their profile. */
  guestPhone: string;
  /** The guest's name, for a phone with no profile yet. */
  guestName?: string;
  /** A floor table to confirm it at now; omit to leave it a request. */
  tableLabel?: string;
};

/**
 * Staff book a table for a guest at the counter or on the phone. It's the guest's
 * booking, on the profile their phone finds — or on one made with it, from their
 * name, when the phone has none — so they see it once they sign in. With a table
 * it's confirmed on the spot (the repository refuses a table a booking or an event
 * already has then); without one it waits as a request. A walk-in may take the
 * quarter hour that's already running.
 */
export class BookTableForGuest {
  constructor(
    private readonly reservationRepo: IReservationRepository,
    private readonly userRepo: Pick<IUserRepository, "getById">,
    /** The floor a table given on the spot must be on. */
    private readonly tables: Pick<ICafeTableRepository, "listAll">,
  ) {}

  async execute(input: BookTableForGuestInput, actor: ActivityActor, now: Date): Promise<Reservation> {
    const { note } = validateBooking(input, now, staffEarliestStart(now));
    if (input.tableLabel !== undefined && !isFloorTable(await readFloor(this.tables), input.tableLabel)) {
      throw new ValidationError("tableLabel", "tableInvalid");
    }
    const guest = await new ResolveGuestProfile(this.userRepo).execute(
      { phone: input.guestPhone, name: input.guestName },
      actor,
    );

    return this.reservationRepo.create(
      {
        userId: guest.userId,
        newGuest: guest.newProfile,
        guestName: guest.name,
        guestPhone: guest.phone,
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
