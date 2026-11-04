import { type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf, isCafeDay, shiftCafeDay } from "../../entities/CafeTime";
import {
  MAX_SUITE_DAYS_AHEAD,
  MAX_SUITE_GUESTS,
  MAX_SUITE_NIGHTS,
  MAX_SUITE_NOTE_LENGTH,
  MIN_SUITE_GUESTS,
  suiteNights,
  type SuiteBooking,
} from "../../entities/SuiteBooking";
import { ValidationError } from "../../errors/ValidationError";
import { ResolveGuestProfile } from "../guest-profiles/ResolveGuestProfile";

import type { User } from "../../entities/User";
import type { ISuiteBookingRepository } from "../../repositories/ISuiteBookingRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

export type RequestSuiteBookingInput = {
  /** Cafe days, `YYYY-MM-DD`. */
  checkIn: string;
  checkOut: string;
  guests: number;
  note?: string;
};

/**
 * The stay rules both a guest and staff are held to: check-in from today on and
 * within the booking horizon, 1–`MAX_SUITE_NIGHTS` nights, a party the suite
 * sleeps, a short note. Returns the note trimmed (or dropped when blank).
 */
function validateStay(input: RequestSuiteBookingInput, now: Date): { note?: string } {
  const { checkIn, checkOut } = input;
  if (!isCafeDay(checkIn)) throw new ValidationError("checkIn", "Choose a check-in day.");
  if (!isCafeDay(checkOut)) throw new ValidationError("checkOut", "Choose a check-out day.");

  const today = cafeDayOf(now);
  if (checkIn < today) throw new ValidationError("checkIn", "Choose a check-in day from today on.");
  if (checkIn > shiftCafeDay(today, MAX_SUITE_DAYS_AHEAD)) {
    throw new ValidationError("checkIn", `The suite can be booked up to ${MAX_SUITE_DAYS_AHEAD} days ahead.`);
  }
  const nights = suiteNights(checkIn, checkOut);
  if (nights < 1) throw new ValidationError("checkOut", "Check-out must be after check-in.");
  if (nights > MAX_SUITE_NIGHTS)
    throw new ValidationError("checkOut", `A stay can be at most ${MAX_SUITE_NIGHTS} nights.`);

  if (!Number.isInteger(input.guests) || input.guests < MIN_SUITE_GUESTS || input.guests > MAX_SUITE_GUESTS) {
    throw new ValidationError("guests", `Guests must be ${MIN_SUITE_GUESTS}–${MAX_SUITE_GUESTS}.`);
  }
  const note = input.note?.trim() || undefined;
  if (note && note.length > MAX_SUITE_NOTE_LENGTH) throw new ValidationError("note", "That note is too long.");
  return { note };
}

/**
 * A signed-in guest asks for the suite. The request is `requested` until staff
 * confirm it; nights another stay already holds are refused up front by the
 * repository, so a guest never asks for dates that are gone.
 */
export class RequestSuiteBooking {
  constructor(private readonly suiteRepo: ISuiteBookingRepository) {}

  async execute(
    input: RequestSuiteBookingInput,
    guest: Pick<User, "id" | "name" | "phone">,
    now: Date,
  ): Promise<SuiteBooking> {
    const { note } = validateStay(input, now);
    return this.suiteRepo.create({
      userId: guest.id,
      guestName: guest.name,
      guestPhone: guest.phone,
      guests: input.guests,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      note,
    });
  }
}

export type BookSuiteForGuestInput = RequestSuiteBookingInput & {
  /** The guest's phone, which finds their profile. */
  guestPhone: string;
  /** The guest's name, for a phone with no profile yet. */
  guestName?: string;
};

/**
 * Staff book the suite for a guest at the counter or on the phone, on the profile
 * their phone finds — or on one made with the stay, from their name, when the
 * phone has none. It's confirmed straight away; the repository refuses nights
 * another stay already holds, under the suite's lock.
 */
export class BookSuiteForGuest {
  constructor(
    private readonly suiteRepo: ISuiteBookingRepository,
    private readonly userRepo: Pick<IUserRepository, "getById">,
  ) {}

  async execute(input: BookSuiteForGuestInput, actor: ActivityActor, now: Date): Promise<SuiteBooking> {
    const { note } = validateStay(input, now);
    const guest = await new ResolveGuestProfile(this.userRepo).execute(
      { phone: input.guestPhone, name: input.guestName },
      actor,
    );

    return this.suiteRepo.create(
      {
        userId: guest.userId,
        newGuest: guest.newProfile,
        guestName: guest.name,
        guestPhone: guest.phone,
        guests: input.guests,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        note,
      },
      "confirmed",
      (saved) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "suiteBooking.booked",
        entityType: "suiteBooking",
        entityId: saved.id,
        entityLabel: `S-${saved.reference}`,
        changes: [{ field: "status", before: null, after: saved.status }],
      }),
    );
  }
}
