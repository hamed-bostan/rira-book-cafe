/**
 * The cafe's clock. Everything is stored as UTC instants; people type and read
 * times on the cafe's wall clock (Tehran). These helpers convert between the two.
 *
 * Iran has observed no daylight saving since 2022, so Tehran is a fixed UTC+03:30
 * and wall time converts with a constant offset — no time-zone database needed,
 * and server and browser always agree.
 */

/** IANA zone, for `Intl` formatting. */
export const CAFE_TIME_ZONE = "Asia/Tehran";

/** The fixed offset, as it appears in an ISO 8601 timestamp. */
export const CAFE_UTC_OFFSET = "+03:30";

const OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

/** `YYYY-MM-DD` */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** `YYYY-MM-DDTHH:mm`, the value of an `<input type="datetime-local">`. */
const WALL_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isCafeDay(value: string): boolean {
  return DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00${CAFE_UTC_OFFSET}`));
}

export function isWallTime(value: string): boolean {
  return WALL_TIME_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}:00${CAFE_UTC_OFFSET}`));
}

/** A cafe wall time (`2026-10-20T19:30`) → the UTC instant it names. */
export function wallTimeToDate(wallTime: string): Date {
  return new Date(`${wallTime}:00${CAFE_UTC_OFFSET}`);
}

/** A UTC instant → the cafe wall time for a `datetime-local` input. */
export function dateToWallTime(date: Date): string {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

/** The cafe day (`YYYY-MM-DD`) an instant falls on. */
export function cafeDayOf(date: Date): string {
  return dateToWallTime(date).slice(0, 10);
}

/** The UTC range `[from, to)` covering one cafe day. */
export function cafeDayRange(day: string): { from: Date; to: Date } {
  const from = new Date(`${day}T00:00:00${CAFE_UTC_OFFSET}`);
  return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
}

/** The cafe day `offset` days from `day` (negative goes back). */
export function shiftCafeDay(day: string, offset: number): string {
  const { from } = cafeDayRange(day);
  return cafeDayOf(new Date(from.getTime() + offset * 24 * 60 * 60 * 1000));
}
