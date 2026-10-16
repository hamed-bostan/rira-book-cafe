import { cafeDayRange } from "../../entities/CafeTime";

import type { Reservation, ReservationStatus } from "../../entities/Reservation";
import type { IReservationRepository } from "../../repositories/IReservationRepository";

/** One cafe day's reservations, in start order — the floor's view. A cross-guest read: gate to staff. */
export class ListReservationsForDay {
  constructor(private readonly reservationRepo: IReservationRepository) {}

  execute(day: string, status?: ReservationStatus): Promise<Reservation[]> {
    const { from, to } = cafeDayRange(day);
    return this.reservationRepo.listBetween(from, to, status);
  }
}

/** The guest's own reservations. */
export class ListOwnReservations {
  constructor(private readonly reservationRepo: IReservationRepository) {}

  execute(userId: string): Promise<Reservation[]> {
    return this.reservationRepo.listForUser(userId);
  }
}
