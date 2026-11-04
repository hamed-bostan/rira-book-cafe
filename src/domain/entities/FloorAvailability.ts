import { TABLE_HOLDING_STATUSES, rangesOverlap, reservationEndsAt, type Reservation } from "./Reservation";

import type { CafeEvent } from "./CafeEvent";
import type { FloorTable } from "./CafeTable";

/**
 * Which floor tables a booking could take, from the day's bookings and events —
 * what the table picker draws. The same rules the repository enforces when the
 * table is saved (a booking holding it, an event holding it); this only lets the
 * picker grey them out up front. "Too small" is advice the server doesn't enforce.
 */

export type FloorBooking = Pick<
  Reservation,
  "id" | "reference" | "status" | "tableLabel" | "startsAt" | "durationMinutes"
>;
export type FloorEvent = Pick<CafeEvent, "id" | "title" | "startsAt" | "endsAt" | "tableLabels">;

/**
 * What holds the floor's tables around one cafe day: the bookings holding a table
 * and the events holding tables. It reaches a day either side, because a booking
 * late the night before runs on into the day, and one late in the day into the next.
 */
export type Floor = {
  /** The tables in use, in floor order — what the pickers draw. */
  tables: FloorTable[];
  bookings: FloorBooking[];
  events: FloorEvent[];
};

/** Why a table can't be chosen: another booking or an event has it then, or it seats too few. */
export type TableBlock =
  { kind: "booking"; reference: number } | { kind: "event"; title: string } | { kind: "tooSmall" };

export type TableChoice = {
  label: string;
  seats: number;
  /** Absent when the table is free for this booking. */
  block?: TableBlock;
};

export type BookingSlot = Pick<Reservation, "startsAt" | "durationMinutes" | "partySize"> & {
  /** The booking being seated or moved — its own table doesn't count against it. */
  reservationId?: string;
};

export function tableChoicesFor(
  slot: BookingSlot,
  tables: readonly FloorTable[],
  bookings: readonly FloorBooking[],
  events: readonly FloorEvent[],
): TableChoice[] {
  const from = new Date(slot.startsAt);
  const to = reservationEndsAt(slot);

  return tables.map(({ label, seats }): TableChoice => {
    const booking = bookings.find(
      (other) =>
        other.id !== slot.reservationId &&
        other.tableLabel === label &&
        (TABLE_HOLDING_STATUSES as readonly string[]).includes(other.status) &&
        rangesOverlap(from, to, new Date(other.startsAt), reservationEndsAt(other)),
    );
    if (booking) return { label, seats, block: { kind: "booking", reference: booking.reference } };

    const event = events.find(
      (other) =>
        other.tableLabels.includes(label) && rangesOverlap(from, to, new Date(other.startsAt), new Date(other.endsAt)),
    );
    if (event) return { label, seats, block: { kind: "event", title: event.title } };

    return seats < slot.partySize ? { label, seats, block: { kind: "tooSmall" } } : { label, seats };
  });
}
