import { cafeDayRange, shiftCafeDay } from "./CafeTime";

/**
 * A stay in the cafe's suite. A guest asks for check-in and check-out days; staff
 * confirm it, check the guest in and out. The suite is one room, so two stays that
 * hold it can never overlap.
 */

/**
 * - `requested` — the guest asked; staff haven't answered. The guest can cancel.
 * - `confirmed` — staff accepted it; the suite is held. The guest can still cancel.
 * - `checkedIn` — the guest arrived.
 * - `checkedOut` — they left. Terminal.
 * - `cancelled` — withdrawn by the guest or declined by staff. Terminal.
 * - `noShow` — the guest never came. Terminal.
 */
export const SUITE_BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "checkedIn",
  "checkedOut",
  "cancelled",
  "noShow",
] as const;
export type SuiteBookingStatus = (typeof SUITE_BOOKING_STATUSES)[number];

/** Statuses that hold the suite — the ones an overlap is checked against. */
export const SUITE_HOLDING_STATUSES = ["confirmed", "checkedIn"] as const satisfies readonly SuiteBookingStatus[];

export const MIN_SUITE_GUESTS = 1;
export const MAX_SUITE_GUESTS = 4;
export const MAX_SUITE_NIGHTS = 14;
/** How far ahead a guest may book. */
export const MAX_SUITE_DAYS_AHEAD = 120;
export const MAX_SUITE_NOTE_LENGTH = 300;
/** A guest's name as staff type it for a phone or counter booking. */
export const MAX_SUITE_GUEST_NAME_LENGTH = 80;

export type SuiteBooking = {
  id: string;
  /** Short sequential number staff and guests refer to (`S-12`). */
  reference: number;
  /** The guest's account; absent for a stay staff booked for them by phone or at the counter. */
  userId?: string;
  /** Guest's name and phone, snapshotted when they booked. */
  guestName: string;
  guestPhone: string;
  guests: number;
  /** Cafe days, `YYYY-MM-DD`. The guest sleeps the nights from `checkIn` up to (not including) `checkOut`. */
  checkIn: string;
  checkOut: string;
  status: SuiteBookingStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

/** A span of nights the suite is held — what the public availability shows, with nobody's name on it. */
export type SuiteBusyRange = Pick<SuiteBooking, "checkIn" | "checkOut">;

const TRANSITIONS: Record<SuiteBookingStatus, readonly SuiteBookingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["checkedIn", "cancelled", "noShow"],
  checkedIn: ["checkedOut"],
  checkedOut: [],
  cancelled: [],
  noShow: [],
};

export function canTransitionSuiteBooking(from: SuiteBookingStatus, to: SuiteBookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The statuses staff may move a booking to from here, in the order the UI offers them. */
export function nextSuiteBookingStatuses(status: SuiteBookingStatus): readonly SuiteBookingStatus[] {
  return TRANSITIONS[status];
}

/** Nights between two cafe days. */
export function suiteNights(checkIn: string, checkOut: string): number {
  return Math.round(
    (cafeDayRange(checkOut).from.getTime() - cafeDayRange(checkIn).from.getTime()) / (24 * 60 * 60 * 1000),
  );
}

/**
 * Whether two stays share a night. Days compare as strings (`YYYY-MM-DD` sorts by
 * date); a check-out on the day of another's check-in doesn't clash.
 */
export function staysOverlap(a: SuiteBusyRange, b: SuiteBusyRange): boolean {
  return a.checkIn < b.checkOut && b.checkIn < a.checkOut;
}

/** Whether the guest may still cancel: before check-in, and before the check-in day. */
export function isGuestCancellableSuiteBooking(
  booking: Pick<SuiteBooking, "status" | "checkIn">,
  today: string,
): boolean {
  return (booking.status === "requested" || booking.status === "confirmed") && booking.checkIn > today;
}

type StayOnCalendar = Pick<SuiteBooking, "id" | "status" | "checkIn" | "checkOut">;

/** Whether a stay holds the suite (and so blocks its nights for everyone else). */
export function holdsSuite(booking: Pick<SuiteBooking, "status">): boolean {
  return (SUITE_HOLDING_STATUSES as readonly string[]).includes(booking.status);
}

/**
 * The stay already holding the suite that a request overlaps — why it can't be
 * confirmed as asked. Only requests clash; a held stay is the one others clash with.
 */
export function heldClashFor<T extends StayOnCalendar>(booking: StayOnCalendar, all: readonly T[]): T | undefined {
  if (booking.status !== "requested") return undefined;
  return all.find((other) => other.id !== booking.id && holdsSuite(other) && staysOverlap(other, booking));
}

/** The first night from `today` on that no held stay covers — where a new stay starts by default. */
export function firstFreeNight(held: readonly SuiteBusyRange[], today: string): string {
  for (let offset = 0; offset < MAX_SUITE_DAYS_AHEAD; offset++) {
    const night = shiftCafeDay(today, offset);
    if (!held.some((range) => staysOverlap(range, { checkIn: night, checkOut: shiftCafeDay(night, 1) }))) return night;
  }
  return today;
}
