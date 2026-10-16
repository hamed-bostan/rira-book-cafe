import { cafeDayOf } from "../../entities/CafeTime";

import type { SuiteBooking, SuiteBookingStatus, SuiteBusyRange } from "../../entities/SuiteBooking";
import type { ISuiteBookingRepository } from "../../repositories/ISuiteBookingRepository";

/** Stays from `fromDay` on, in check-in order — the front desk's view. A cross-guest read: gate to staff. */
export class ListSuiteBookings {
  constructor(private readonly suiteRepo: ISuiteBookingRepository) {}

  execute(fromDay: string, status?: SuiteBookingStatus): Promise<SuiteBooking[]> {
    return this.suiteRepo.listFrom(fromDay, status);
  }
}

/** The guest's own stays. */
export class ListOwnSuiteBookings {
  constructor(private readonly suiteRepo: ISuiteBookingRepository) {}

  execute(userId: string): Promise<SuiteBooking[]> {
    return this.suiteRepo.listForUser(userId);
  }
}

/** The nights already taken from today on — public, so it carries no names. */
export class GetSuiteAvailability {
  constructor(private readonly suiteRepo: ISuiteBookingRepository) {}

  execute(now: Date): Promise<SuiteBusyRange[]> {
    return this.suiteRepo.listBusyFrom(cafeDayOf(now));
  }
}
