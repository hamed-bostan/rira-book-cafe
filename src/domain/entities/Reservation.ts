import type { ReservationDeposit } from "./ReservationDeposit";

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

/**
 * The bookings a day counts: every one that is on or has happened — waiting for an
 * answer, booked, at the table, or finished. Cancelled and no-show ones aren't.
 */
export const DAY_BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "seated",
  "completed",
] as const satisfies readonly ReservationStatus[];

/** Statuses that hold a table — the ones a double booking is checked against. */
export const TABLE_HOLDING_STATUSES = ["confirmed", "seated"] as const satisfies readonly ReservationStatus[];

export const MIN_PARTY_SIZE = 1;
/**
 * The biggest party a booking takes. A bigger group books for this many and says
 * how many they are in the note; staff answer in the guest's messages.
 */
export const MAX_PARTY_SIZE = 12;
/** How long a table is held for a booking, in minutes, unless staff give it another length. */
export const DEFAULT_RESERVATION_MINUTES = 90;
/**
 * The lengths staff can give a booking, in minutes, the default among them. Each
 * booking stores its own (`durationMinutes`); `reservationEndsAt` is the one place
 * its end is worked out. The longest stays well inside the six hours the clash
 * check looks back over (`tableHolds.ts`), which the database also holds to.
 */
export const RESERVATION_LENGTHS = [60, 90, 120, 180] as const;
/** How far ahead a guest may book. */
export const MAX_BOOKING_DAYS_AHEAD = 60;
/** Booking times fall on quarter hours. */
export const BOOKING_SLOT_MINUTES = 15;

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Every bookable start of a day, `HH:mm` on the cafe's wall clock: each quarter
 * hour from 00:00 to 23:45. A table can be booked for any time of day, by a guest
 * or by staff; a late booking runs on past midnight, and stays on the day it starts.
 */
export const BOOKING_TIMES: readonly string[] = Array.from({ length: (24 * 60) / BOOKING_SLOT_MINUTES }, (_, index) => {
  const minutes = index * BOOKING_SLOT_MINUTES;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
});

export const MAX_RESERVATION_NOTE_LENGTH = 300;

export type Reservation = {
  id: string;
  /** Short sequential number staff and guests refer to. */
  reference: number;
  /**
   * The guest's profile — theirs when they booked themselves, the one their phone
   * found (or made) when staff booked for them. Absent only on an old booking
   * that had no usable phone.
   */
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
  /**
   * ISO 8601 (UTC): when the jobs cancelled it, a request nobody answered before it
   * began ({@link isRequestUnanswered}). Only on a `cancelled` booking.
   */
  expiredAt?: string;
  /** The table staff assigned, once confirmed. */
  tableLabel?: string;
  /** The guest's request, e.g. "window seat, it's a birthday". */
  note?: string;
  /** Money left against the booking, when staff took some (see `ReservationDeposit.ts`). */
  deposit?: ReservationDeposit;
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

/**
 * Whether a request has gone unanswered past its start: nobody confirmed or
 * declined it by the time it was for, so the jobs cancel it as expired.
 */
export function isRequestUnanswered(reservation: Pick<Reservation, "status" | "startsAt">, now: Date): boolean {
  return reservation.status === "requested" && new Date(reservation.startsAt) <= now;
}

/** Whether the party is due — their booking has started — so staff may mark them a no-show. */
export function isReservationDue(reservation: Pick<Reservation, "startsAt">, now: Date): boolean {
  return new Date(reservation.startsAt) <= now;
}

/**
 * The details of a booking staff can edit, in the order the "Edit booking" dialog
 * shows them. Not the guest: a booking's guest is its profile.
 */
export const RESERVATION_DETAILS = ["startsAt", "partySize", "durationMinutes", "note", "tableLabel"] as const;
export type ReservationDetail = (typeof RESERVATION_DETAILS)[number];

/** The details whose change is news to the guest: when, how many, how long. */
export const RESCHEDULE_DETAILS = [
  "startsAt",
  "partySize",
  "durationMinutes",
] as const satisfies readonly ReservationDetail[];

/** Once the party is at the table, only how long they keep it and which table it is can change. */
const SEATED_DETAILS: readonly ReservationDetail[] = ["durationMinutes", "tableLabel"];

/**
 * What staff may change on a booking now: everything while it's requested or
 * confirmed, only the length and the table once the party is seated, nothing once
 * it's over.
 */
export function editableReservationDetails(reservation: Pick<Reservation, "status">): readonly ReservationDetail[] {
  if (reservation.status === "requested" || reservation.status === "confirmed") return RESERVATION_DETAILS;
  return reservation.status === "seated" ? SEATED_DETAILS : [];
}

/** The instant the table is free again. */
export function reservationEndsAt(reservation: Pick<Reservation, "startsAt" | "durationMinutes">): Date {
  return new Date(new Date(reservation.startsAt).getTime() + reservation.durationMinutes * 60 * 1000);
}

/** Whether two time ranges overlap (touching ends don't count — back-to-back is fine). */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
