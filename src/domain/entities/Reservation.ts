/**
 * A table reservation: a guest asks for a time and a party size; staff confirm it
 * (assigning a table), seat the party when they arrive, and close it out.
 */

/**
 * - `requested` — the guest asked; staff haven't answered. The guest can cancel.
 * - `confirmed` — staff accepted it, usually with a table. The guest can still cancel.
 * - `seated` — the party arrived and sat down.
 * - `completed` — they left. Terminal.
 * - `cancelled` — withdrawn by the guest or declined by staff. Terminal.
 * - `noShow` — the party never came. Terminal.
 */
export const RESERVATION_STATUSES = ["requested", "confirmed", "seated", "completed", "cancelled", "noShow"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Statuses that hold a table — the ones a double booking is checked against. */
export const TABLE_HOLDING_STATUSES = ["confirmed", "seated"] as const satisfies readonly ReservationStatus[];

export const MIN_PARTY_SIZE = 1;
/** Bigger groups book by phone — the floor plan has no table for them. */
export const MAX_PARTY_SIZE = 12;
/** How long a table is held for a booking, in minutes. */
export const DEFAULT_RESERVATION_MINUTES = 90;
/** How far ahead a guest may book. */
export const MAX_BOOKING_DAYS_AHEAD = 60;
/** Booking times fall on quarter hours. */
export const BOOKING_SLOT_MINUTES = 15;
/** The first and last hour staff can book a table at (cafe wall clock). */
export const FIRST_BOOKING_HOUR = 8;
export const LAST_BOOKING_HOUR = 21;
export const MAX_RESERVATION_NOTE_LENGTH = 300;
/** A guest's name as staff type it for a phone or walk-in booking. */
export const MAX_GUEST_NAME_LENGTH = 80;
export const MAX_TABLE_LABEL_LENGTH = 20;

export type Reservation = {
  id: string;
  /** Short sequential number staff and guests refer to. */
  reference: number;
  /** The guest's account; absent for a phone or walk-in booking staff made for them. */
  userId?: string;
  /** Guest's name and phone, snapshotted when they booked. */
  guestName: string;
  guestPhone: string;
  partySize: number;
  /** ISO 8601 (UTC) start. */
  startsAt: string;
  /** How long the table is held, in minutes. */
  durationMinutes: number;
  status: ReservationStatus;
  /** The table staff assigned, once confirmed. */
  tableLabel?: string;
  /** The guest's request, e.g. "window seat, it's a birthday". */
  note?: string;
  createdAt: string;
  updatedAt: string;
};

const TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["seated", "cancelled", "noShow"],
  seated: ["completed"],
  completed: [],
  cancelled: [],
  noShow: [],
};

export function canTransitionReservation(from: ReservationStatus, to: ReservationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The statuses staff may move a reservation to from here, in the order the UI offers them. */
export function nextReservationStatuses(status: ReservationStatus): readonly ReservationStatus[] {
  return TRANSITIONS[status];
}

/** Whether the guest may still cancel: before staff seat them, and before it starts. */
export function isGuestCancellableReservation(
  reservation: Pick<Reservation, "status" | "startsAt">,
  now: Date,
): boolean {
  return (
    (reservation.status === "requested" || reservation.status === "confirmed") && new Date(reservation.startsAt) > now
  );
}

/** The instant the table is free again. */
export function reservationEndsAt(reservation: Pick<Reservation, "startsAt" | "durationMinutes">): Date {
  return new Date(new Date(reservation.startsAt).getTime() + reservation.durationMinutes * 60 * 1000);
}

/** Whether two time ranges overlap (touching ends don't count — back-to-back is fine). */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
