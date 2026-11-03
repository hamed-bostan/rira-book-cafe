import { RESERVATION_STATUSES, type Reservation, type ReservationStatus } from "@/src/domain/entities/Reservation";

/** A status tab on the day view: a status, or `expired`. */
export type ReservationTab = ReservationStatus | "expired";

/**
 * The day view's status tabs: one per status, with the requests nobody answered
 * in time (`expiredAt`) in a tab of their own after Cancelled — so Cancelled is
 * what a person cancelled, and the tabs still add up to the day.
 */
export const RESERVATION_TABS: readonly ReservationTab[] = RESERVATION_STATUSES.flatMap((status): ReservationTab[] =>
  status === "cancelled" ? [status, "expired"] : [status],
);

/** The tab a booking is counted under. */
export function reservationTab(reservation: Pick<Reservation, "status" | "expiredAt">): ReservationTab {
  return reservation.expiredAt ? "expired" : reservation.status;
}
