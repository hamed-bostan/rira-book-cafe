/**
 * Something happening at the cafe that guests sign up for — a book club meeting,
 * an author reading, a workshop. (Named `CafeEvent` so it never collides with the
 * DOM's `Event`.)
 */

export const EVENT_KINDS = ["bookClub", "reading", "workshop", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Most seats one guest can take in a single registration. */
export const MAX_SEATS_PER_REGISTRATION = 6;
export const MAX_EVENT_TITLE_LENGTH = 120;
export const MAX_EVENT_DESCRIPTION_LENGTH = 4000;

export type CafeEvent = {
  id: string;
  kind: EventKind;
  title: string;
  description?: string;
  /** Optional Persian copy; falls back to the base copy when absent. */
  titleFa?: string;
  descriptionFa?: string;
  imageUrl?: string;
  /** ISO 8601 (UTC). */
  startsAt: string;
  endsAt: string;
  /** Seats available; `undefined` means no limit. */
  capacity?: number;
  /** Ticket price in Toman; 0 is free. */
  price: number;
  /** Whether guests can see it and sign up. */
  isPublished: boolean;
  /** Seats taken by active registrations. Derived, not stored. */
  seatsTaken: number;
  createdAt: string;
  updatedAt: string;
};

/** Seats still free, or `undefined` when the event has no limit. */
export function seatsLeft(event: Pick<CafeEvent, "capacity" | "seatsTaken">): number | undefined {
  return event.capacity === undefined ? undefined : Math.max(event.capacity - event.seatsTaken, 0);
}

/** Whether guests may still sign up: published, not started, and not full. */
export function isOpenForRegistration(event: Pick<CafeEvent, "isPublished" | "startsAt" | "capacity" | "seatsTaken">, now: Date): boolean {
  const left = seatsLeft(event);
  return event.isPublished && new Date(event.startsAt) > now && (left === undefined || left > 0);
}

export const REGISTRATION_STATUSES = ["registered", "cancelled"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** One guest's sign-up for an event. */
export type EventRegistration = {
  id: string;
  eventId: string;
  userId: string;
  /** Snapshotted at sign-up. */
  guestName: string;
  guestPhone: string;
  seats: number;
  status: RegistrationStatus;
  createdAt: string;
};
