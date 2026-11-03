import type { Reservation, ReservationStatus } from "@/src/domain/entities/Reservation";

/** The bookings still ahead of the floor today — the ones the overview lists. */
const AHEAD_STATUSES: readonly ReservationStatus[] = ["requested", "confirmed", "seated"];

/** The one status the day counts that the list leaves out: the party has been and gone. */
export const FINISHED_BOOKING_STATUS = "completed" satisfies ReservationStatus;

/**
 * Today's bookings split the way the overview shows them: the ones still ahead,
 * which it lists, and how many have finished, which it counts under the list.
 * Together they're every booking the Bookings today card counts
 * (`DAY_BOOKING_STATUSES`), so the two always add up; cancelled and no-show
 * bookings are in neither, as on the card.
 */
export function splitTodaysBookings(reservations: readonly Reservation[]): { ahead: Reservation[]; finished: number } {
  return {
    ahead: reservations.filter((reservation) => AHEAD_STATUSES.includes(reservation.status)),
    finished: reservations.filter((reservation) => reservation.status === FINISHED_BOOKING_STATUS).length,
  };
}
