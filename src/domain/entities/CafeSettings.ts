import { cafeDayOf, dateToWallTime, shiftCafeDay } from "./CafeTime";

/**
 * The cafe's own configuration, kept in the dashboard's settings: who and where it
 * is, when it's open, and what its receipts say. Every field is optional — the
 * site leaves out whatever isn't filled in rather than guessing it.
 *
 * The cafe's clock is always Asia/Tehran (`CafeTime`); it isn't a setting.
 */

/** The week as Iran reads it, Saturday first — the order the hours form and the site list days. */
export const WEEKDAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
/** A day of the week, spelled as schema.org spells it (`https://schema.org/DayOfWeek`). */
export type Weekday = (typeof WEEKDAYS)[number];

export const MAX_CAFE_NAME_LENGTH = 80;
export const MAX_CAFE_ADDRESS_LENGTH = 300;
export const MAX_CAFE_PHONE_LENGTH = 30;
export const MAX_CAFE_URL_LENGTH = 200;
/** Instagram's own limit on a username. */
export const MAX_INSTAGRAM_HANDLE_LENGTH = 30;
export const MAX_HOURS_EXCEPTIONS = 60;
export const MAX_HOURS_NOTE_LENGTH = 80;
export const MAX_RECEIPT_TEXT_LENGTH = 300;
/** A receipt header is a few short lines above the order, not a letter. */
export const MAX_RECEIPT_HEADER_LINES = 4;
/** How far ahead the site lists special hours. */
export const UPCOMING_EXCEPTION_DAYS = 60;

export type CafeProfile = {
  /** The cafe's name in English; the site's own name stands in while it's blank. */
  name?: string;
  nameFa?: string;
  address?: string;
  addressFa?: string;
  /** As guests should dial it, e.g. `021 1234 5678` or `+98 21 1234 5678`. */
  phone?: string;
  /** The Instagram username, without the `@`. */
  instagram?: string;
  /** An `https://` (or `http://`) address. */
  website?: string;
  latitude?: number;
  longitude?: number;
};

/**
 * One day's hours on the cafe's wall clock (`HH:mm`). A close at or before the
 * open runs past midnight (`10:00`–`01:00`). A closed day has neither time.
 */
export type DayHours = { closed: boolean; opens?: string; closes?: string };

export type WeeklyHours = Record<Weekday, DayHours>;

/** A day whose hours differ from its weekday's: a holiday, a late night. */
export type HoursException = DayHours & {
  /** The cafe day, `YYYY-MM-DD`. */
  date: string;
  /** Why, for guests ("Nowruz"), in English and Persian. */
  note?: string;
  noteFa?: string;
};

export type OpeningHours = {
  /** `null` until staff first set the week — the site then shows no hours at all. */
  weekly: WeeklyHours | null;
  /** In date order. */
  exceptions: HoursException[];
};

export type ReceiptSettings = {
  /** Lines printed under the cafe's name, in English and Persian. */
  header?: string;
  headerFa?: string;
  /** A note at the foot of the slip ("Thank you — see you soon"). */
  footer?: string;
  footerFa?: string;
};

export type CafeSettings = {
  profile: CafeProfile;
  hours: OpeningHours;
  receipt: ReceiptSettings;
};

/** Nothing set yet: what the site has before anyone opens the settings. */
export const EMPTY_CAFE_SETTINGS: CafeSettings = {
  profile: {},
  hours: { weekly: null, exceptions: [] },
  receipt: {},
};

/** One opening-hours rule for structured data, e.g. Saturday–Wednesday 08:00–23:00. */
export type OpeningHoursRule = { days: Weekday[]; opens: string; closes: string };

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A wall-clock time, `HH:mm` from `00:00` to `23:59`. */
export function isClockTime(value: string): boolean {
  return CLOCK.test(value);
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** JavaScript's `getUTCDay()` numbering (0 = Sunday) as weekdays. */
const BY_JS_DAY: readonly Weekday[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The weekday a cafe day (`YYYY-MM-DD`) falls on. */
export function weekdayOf(day: string): Weekday {
  return BY_JS_DAY[new Date(`${day}T00:00:00Z`).getUTCDay()];
}

/** Whether these hours have the cafe open: not closed, with both times set. */
function isOpenDay(hours: DayHours): hours is { closed: false; opens: string; closes: string } {
  return !hours.closed && hours.opens !== undefined && hours.closes !== undefined;
}

/** Whether open hours run past midnight into the next day. */
export function runsPastMidnight(hours: DayHours): boolean {
  return isOpenDay(hours) && minutesOf(hours.closes) <= minutesOf(hours.opens);
}

/** The hours that hold on one cafe day: its exception if it has one, else its weekday's — `null` when unknown. */
export function hoursOn(hours: OpeningHours, day: string): DayHours | null {
  const exception = hours.exceptions.find((candidate) => candidate.date === day);
  if (exception) return { closed: exception.closed, opens: exception.opens, closes: exception.closes };
  return hours.weekly ? hours.weekly[weekdayOf(day)] : null;
}

/**
 * Whether the cafe is open at an instant, by its wall clock — `null` when the hours
 * haven't been set, so nothing is claimed either way. A day whose hours run past
 * midnight keeps the cafe open into the small hours of the next.
 */
export function isOpenAt(hours: OpeningHours, at: Date): boolean | null {
  if (!hours.weekly) return null;
  const today = cafeDayOf(at);
  const now = minutesOf(dateToWallTime(at).slice(11, 16));

  const todays = hoursOn(hours, today);
  if (todays && isOpenDay(todays)) {
    const opens = minutesOf(todays.opens);
    const closes = minutesOf(todays.closes);
    if (closes > opens ? now >= opens && now < closes : now >= opens) return true;
  }
  const yesterdays = hoursOn(hours, shiftCafeDay(today, -1));
  if (yesterdays && isOpenDay(yesterdays) && runsPastMidnight(yesterdays)) {
    if (now < minutesOf(yesterdays.closes)) return true;
  }
  return false;
}

/**
 * When the cafe next opens after an instant, within the coming week — `null` when
 * the hours are unset or nothing is open that week.
 */
export function nextOpening(hours: OpeningHours, at: Date): { day: string; opens: string } | null {
  if (!hours.weekly) return null;
  const today = cafeDayOf(at);
  const now = minutesOf(dateToWallTime(at).slice(11, 16));
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = shiftCafeDay(today, offset);
    const dayHours = hoursOn(hours, day);
    if (!dayHours || !isOpenDay(dayHours)) continue;
    if (offset === 0 && minutesOf(dayHours.opens) <= now) continue;
    return { day, opens: dayHours.opens };
  }
  return null;
}

/** The special hours from `today` through the coming weeks, in date order — what the site lists. */
export function upcomingExceptions(
  hours: OpeningHours,
  today: string,
  days: number = UPCOMING_EXCEPTION_DAYS,
): HoursException[] {
  const last = shiftCafeDay(today, days);
  return hours.exceptions
    .filter((exception) => exception.date >= today && exception.date <= last)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The open days of the week grouped by identical hours, in Saturday-first order —
 * schema.org's `OpeningHoursSpecification`, and the rows of the site's hours table.
 */
export function openingRules(weekly: WeeklyHours): OpeningHoursRule[] {
  const rules: OpeningHoursRule[] = [];
  for (const day of WEEKDAYS) {
    const hours = weekly[day];
    if (!isOpenDay(hours)) continue;
    const same = rules.find((rule) => rule.opens === hours.opens && rule.closes === hours.closes);
    if (same) same.days.push(day);
    else rules.push({ days: [day], opens: hours.opens, closes: hours.closes });
  }
  return rules;
}

/** The days the cafe is closed every week. */
export function closedWeekdays(weekly: WeeklyHours): Weekday[] {
  return WEEKDAYS.filter((day) => !isOpenDay(weekly[day]));
}

/** One day's hours as one activity-log value: `08:00–23:00`, or `closed`. */
export function dayHoursValue(hours: DayHours | undefined): string | null {
  if (!hours) return null;
  return isOpenDay(hours) ? `${hours.opens}–${hours.closes}` : "closed";
}

/** A username from what staff paste: `rira.cafe`, `@rira.cafe` or the profile's address. */
export function instagramHandle(value: string): string {
  const fromUrl = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i.exec(value.trim());
  return (fromUrl ? fromUrl[1] : value.trim()).replace(/^@/, "");
}

/** The Instagram profile a handle points at. */
export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}

/** Where the map position is, on OpenStreetMap — the site's "Directions" link. */
export function mapUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

/** The text in the reader's language, or the other language's when theirs is blank. */
export function inLanguage(locale: string, en: string | undefined, fa: string | undefined): string | undefined {
  return (locale === "fa" ? fa || en : en || fa) || undefined;
}
