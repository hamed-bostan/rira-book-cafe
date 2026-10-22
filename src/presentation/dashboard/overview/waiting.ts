/** A wait that's getting long: shown in amber, and counted on the queue's card. */
export const WAIT_WARN_MINUTES = 10;
/** A wait that's too long: shown in red. */
export const WAIT_LATE_MINUTES = 20;

/** Whole minutes between placing and `now`, never negative (clocks drift). */
export function minutesWaiting(placedAt: string, now: string): number {
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(placedAt)) / 60_000));
}
