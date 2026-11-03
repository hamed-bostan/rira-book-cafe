import { shiftCafeDay, wallTimeToDate } from "./CafeTime";

/**
 * When guests are reminded of what's coming up — a table, a stay, an event, a book
 * due back. The background jobs send them (there's no SMS: they land in the
 * guest's inbox, addressed by phone); these rules decide *when*. Times are on the
 * cafe's wall clock.
 */

/** The hour (cafe wall clock) an evening-before reminder goes out: "see you tomorrow". */
export const EVENING_REMINDER_HOUR = 18;

/** How long before a table booking its "soon" reminder goes out. */
export const SOON_REMINDER_HOURS = 2;

/**
 * A reminder goes out within this long of its moment or not at all: one the jobs
 * didn't get to in time (the server was down) is skipped rather than sent late.
 * The runner's interval is capped well under it, so every moment sees a run.
 */
export const REMINDER_LATE_LIMIT_MINUTES = 60;

/** The evening before a cafe day: {@link EVENING_REMINDER_HOUR}:00 on the day before it. */
export function eveningBefore(day: string): Date {
  const hour = String(EVENING_REMINDER_HOUR).padStart(2, "0");
  return wallTimeToDate(`${shiftCafeDay(day, -1)}T${hour}:00`);
}

/** {@link SOON_REMINDER_HOURS} before `startsAt`. */
export function soonBefore(startsAt: Date): Date {
  return new Date(startsAt.getTime() - SOON_REMINDER_HOURS * 60 * 60 * 1000);
}

/**
 * Whether a reminder due at `moment` goes out at `now`: its moment has come, it's
 * not more than {@link REMINDER_LATE_LIMIT_MINUTES} past, and the thing it's about
 * already existed at the moment. A reminder whose moment had passed by the time
 * the booking was made is skipped, not sent late — a table booked an hour ahead
 * gets no "tomorrow" or "in two hours" reminder.
 */
export function isReminderDue(moment: Date, existedSince: Date, now: Date): boolean {
  const late = now.getTime() - moment.getTime();
  return late >= 0 && late < REMINDER_LATE_LIMIT_MINUTES * 60 * 1000 && existedSince <= moment;
}
