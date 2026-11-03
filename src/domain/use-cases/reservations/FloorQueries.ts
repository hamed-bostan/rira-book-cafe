import { cafeDayRange, shiftCafeDay } from "../../entities/CafeTime";
import { TABLE_HOLDING_STATUSES } from "../../entities/Reservation";

import type { Floor } from "../../entities/FloorAvailability";
import type { IEventRepository } from "../../repositories/IEventRepository";
import type { IReservationRepository } from "../../repositories/IReservationRepository";

/**
 * The floor around one cafe day (`Floor`), for the table pickers: the bookings
 * holding a table and the events holding tables from the day before to the day
 * after, so a booking near midnight on either side still blocks its table. Only
 * what a picker needs — no guest names or phones. A cross-guest read: gate to staff.
 */
export class ReadFloorForDay {
  constructor(
    private readonly reservationRepo: IReservationRepository,
    private readonly eventRepo: IEventRepository,
  ) {}

  async execute(day: string): Promise<Floor> {
    const from = cafeDayRange(shiftCafeDay(day, -1)).from;
    const to = cafeDayRange(shiftCafeDay(day, 1)).to;
    const [reservations, events] = await Promise.all([
      this.reservationRepo.listBetween(from, to),
      this.eventRepo.listAll(),
    ]);
    return {
      bookings: reservations
        .filter(
          (booking) => booking.tableLabel && (TABLE_HOLDING_STATUSES as readonly string[]).includes(booking.status),
        )
        .map(({ id, reference, status, tableLabel, startsAt, durationMinutes }) => ({
          id,
          reference,
          status,
          tableLabel,
          startsAt,
          durationMinutes,
        })),
      events: events
        .filter(
          (event) => event.tableLabels.length > 0 && new Date(event.startsAt) < to && new Date(event.endsAt) > from,
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map(({ id, title, startsAt, endsAt, tableLabels }) => ({ id, title, startsAt, endsAt, tableLabels })),
    };
  }
}
