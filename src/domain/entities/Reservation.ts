import { dateToWallTime } from "./CafeTime";

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
/**
 * The first and last hour a table can be booked for (cafe wall clock), by a guest
 * or by staff: both forms offer only `BOOKING_TIMES`, and the use-cases refuse
 * anything outside them. The `outsideBookingHours` message names these hours.
 */
export const FIRST_BOOKING_HOUR = 8;
export const LAST_BOOKING_HOUR = 21;

const pad = (n: number): string => String(n).padStart(2, "0");

/** Every bookable start of a day, `HH:mm` on the cafe's wall clock: each quarter hour from first to last. */
export const BOOKING_TIMES: readonly string[] = Array.from(
  { length: ((LAST_BOOKING_HOUR - FIRST_BOOKING_HOUR) * 60) / BOOKING_SLOT_MINUTES + 1 },
  (_, index) => {
    const minutes = FIRST_BOOKING_HOUR * 60 + index * BOOKING_SLOT_MINUTES;
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  },
);

/**
 * Whether an instant falls within the booking hours on the cafe's wall clock, the
 * last hour itself included. Whether it's on a quarter-hour mark is checked apart.
 */
export function isWithinBookingHours(startsAt: Date): boolean {
  const [hours, minutes] = dateToWallTime(startsAt).slice(11).split(":").map(Number);
  const at = hours * 60 + minutes;
  return at >= FIRST_BOOKING_HOUR * 60 && at <= LAST_BOOKING_HOUR * 60;
}

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

/**
 * The one-click steps staff can take back from their toast: seating a party and
 * completing a booking. Each touches only the booking itself — the guest isn't
 * told — so stepping back is safe; going back to `seated` still needs the table
 * free (the repository's usual check). The workflow above never moves backwards;
 * this is the only way back, and only one step.
 */
const UNDO_STEPS: Partial<Record<ReservationStatus, ReservationStatus>> = {
  seated: "confirmed",
  completed: "seated",
};

/** Whether `from → to` takes back a Seat or Complete (an undo), rather than moving the workflow on. */
export function canUndoReservationStatus(from: ReservationStatus, to: ReservationStatus): boolean {
  return UNDO_STEPS[from] === to;
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
