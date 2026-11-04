import { ValidationError } from "../errors/ValidationError";

/**
 * The owner's team-wide security settings.
 *
 * - `requireTwoFactor` — every dashboard user must use an authenticator app. Someone
 *   without one is sent to set it up the next time they open the dashboard. It only
 *   takes effect while two-factor is available on the server (an encryption key is
 *   configured); without one nobody could comply, so it can't be enforced.
 * - `activityRetentionMonths` — how long the activity log keeps entries; `null`
 *   keeps them forever, which is the default.
 */
export type TeamSettings = {
  requireTwoFactor: boolean;
  activityRetentionMonths: number | null;
};

export const DEFAULT_TEAM_SETTINGS: TeamSettings = { requireTwoFactor: false, activityRetentionMonths: null };

/**
 * The retention periods the setting offers, in months. Six months is the floor: an
 * audit log shorter than that rarely outlives the question someone brings to it
 * (a supplier dispute, a year-end, a payroll query), and the setting is one click.
 */
export const ACTIVITY_RETENTION_MONTHS = [6, 12, 24, 36, 60, 120] as const;

/** Check a retention value: `null` (forever) or one of the offered periods. */
export function validRetentionMonths(value: number | null): number | null {
  if (value === null) return null;
  if (!(ACTIVITY_RETENTION_MONTHS as readonly number[]).includes(value)) {
    throw new ValidationError("activityRetentionMonths", "Choose one of the offered periods.");
  }
  return value;
}

/**
 * The instant before which entries are past retention: `months` calendar months
 * before `now`. Month arithmetic in UTC — a few hours either side of a month's
 * edge makes no difference to a retention measured in half-years.
 */
export function activityRetentionCutoff(now: Date, months: number): Date {
  const cutoff = new Date(now.getTime());
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  // Clamp to the target month's last day (31 March − 1 month → 28/29 February).
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff;
}
