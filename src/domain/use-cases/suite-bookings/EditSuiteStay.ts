import { activityValue, type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf, isCafeDay, shiftCafeDay } from "../../entities/CafeTime";
import {
  MAX_SUITE_DAYS_AHEAD,
  MAX_SUITE_GUESTS,
  MAX_SUITE_NIGHTS,
  MIN_SUITE_GUESTS,
  SUITE_STAY_DETAILS,
  editableSuiteStayDetails,
  suiteNights,
  type SuiteBooking,
} from "../../entities/SuiteBooking";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { suiteChangedNotification } from "../notifications/guestNotifications";

import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { ISuiteBookingRepository, SuiteStayEdit } from "../../repositories/ISuiteBookingRepository";

/** What staff send from the "Edit stay" dialog. A detail left out keeps its value. */
export type SuiteStayInput = {
  /** Cafe days, `YYYY-MM-DD`. */
  checkIn?: string;
  checkOut?: string;
  guests?: number;
};

/**
 * Staff change a stay: its arrival and departure days and how many it's for
 * while it's requested or confirmed, or — once the guest is in — only the
 * departure, to extend or shorten it (`editableSuiteStayDetails`). The nights are
 * held to the booking rules (an arrival from today on and within the horizon, a
 * departure not in the past, 1–`MAX_SUITE_NIGHTS` nights), and the repository
 * refuses nights another stay holds, under the suite's lock. The guest is told.
 *
 * Nothing worked out from the dates is stored, so a stay's price (its nights at
 * its rate) follows the new dates on its own.
 */
export class EditSuiteStay {
  constructor(
    private readonly suiteRepo: ISuiteBookingRepository,
    /** Tells the guest their stay was changed. */
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(id: string, input: SuiteStayInput, staff: ActivityActor, now: Date): Promise<SuiteBooking> {
    const current = await this.suiteRepo.getById(id);
    if (!current) throw new NotFoundError("suite booking", id);
    const editable = editableSuiteStayDetails(current);
    if (editable.length === 0) {
      throw new ConflictError("INVALID_TRANSITION", `A ${current.status} suite booking can't be changed.`);
    }

    const next: SuiteStayEdit = {
      checkIn: input.checkIn ?? current.checkIn,
      checkOut: input.checkOut ?? current.checkOut,
      guests: input.guests ?? current.guests,
    };
    const changed = SUITE_STAY_DETAILS.filter((detail) => next[detail] !== current[detail]);
    if (changed.length === 0) return current;

    const locked = changed.find((detail) => !editable.includes(detail));
    if (locked) throw new ValidationError(locked, "Once the guest is in, only the departure day can change.");

    const today = cafeDayOf(now);
    if (!isCafeDay(next.checkIn)) throw new ValidationError("checkIn", "Choose a check-in day.");
    if (!isCafeDay(next.checkOut)) throw new ValidationError("checkOut", "Choose a check-out day.");
    if (changed.includes("checkIn")) {
      if (next.checkIn < today) throw new ValidationError("checkIn", "Choose a check-in day from today on.");
      if (next.checkIn > shiftCafeDay(today, MAX_SUITE_DAYS_AHEAD)) {
        throw new ValidationError("checkIn", `The suite can be booked up to ${MAX_SUITE_DAYS_AHEAD} days ahead.`);
      }
    }
    if (changed.includes("checkOut") && next.checkOut < today) {
      throw new ValidationError("checkOut", "Choose a check-out day from today on.");
    }
    const nights = suiteNights(next.checkIn, next.checkOut);
    if (nights < 1) throw new ValidationError("checkOut", "Check-out must be after check-in.");
    if (nights > MAX_SUITE_NIGHTS) {
      throw new ValidationError("checkOut", `A stay can be at most ${MAX_SUITE_NIGHTS} nights.`);
    }
    if (!Number.isInteger(next.guests) || next.guests < MIN_SUITE_GUESTS || next.guests > MAX_SUITE_GUESTS) {
      throw new ValidationError("guests", `Guests must be ${MIN_SUITE_GUESTS}–${MAX_SUITE_GUESTS}.`);
    }

    const saved = await this.suiteRepo.applyStayEdit(id, current.status, next, (saved) => ({
      actorId: staff.id,
      actorName: staff.name,
      action: "suiteBooking.changed",
      entityType: "suiteBooking",
      entityId: saved.id,
      entityLabel: `S-${saved.reference}`,
      changes: changed.map((detail) => ({
        field: detail,
        before: activityValue(current[detail]),
        after: activityValue(saved[detail]),
      })),
    }));

    if (this.notifier) await this.notifier.notify(suiteChangedNotification(saved));
    return saved;
  }
}
