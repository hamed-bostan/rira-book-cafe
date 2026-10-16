import { cafeDayOf } from "./CafeTime";

/**
 * The Persian (Jalali / Solar Hijri) calendar, for fiscal periods. The cafe's
 * fiscal year starts on 1 Farvardin and its months are Persian months, so period
 * boundaries need exact Gregorian ↔ Jalali conversion — formatting alone (which
 * `Intl` already does) isn't enough.
 *
 * The arithmetic is the well-known `jalaali-js` algorithm (Borkowski's leap-year
 * breaks), valid for Jalali years −61 … 3177. Dates are plain cafe days
 * (`YYYY-MM-DD`, Gregorian) on the way in and out, matching `CafeTime`.
 */

export type JalaliDate = { jy: number; jm: number; jd: number };

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

const div = (a: number, b: number): number => Math.trunc(a / b);
const mod = (a: number, b: number): number => a - Math.trunc(a / b) * b;

/** Leap state of a Jalali year and the March day (Gregorian) its Nowruz falls on. */
function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  if (jy < jp || jy >= BREAKS[BREAKS.length - 1]) throw new RangeError(`Jalali year ${jy} is out of range.`);

  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

/** Gregorian → Julian Day Number. */
function g2d(gy: number, gm: number, gd: number): number {
  const d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}

/** Julian Day Number → Gregorian. */
function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const { gy, march } = jalCal(jy);
  return g2d(gy, 3, march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): JalaliDate {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  let k = jdn - g2d(gy, 3, r.march);

  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

function parseDay(day: string): { gy: number; gm: number; gd: number } {
  const [gy, gm, gd] = day.split("-").map(Number);
  return { gy, gm, gd };
}

function formatDay({ gy, gm, gd }: { gy: number; gm: number; gd: number }): string {
  return `${String(gy).padStart(4, "0")}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

/** A Gregorian cafe day (`YYYY-MM-DD`) → its Jalali date. */
export function toJalali(day: string): JalaliDate {
  const { gy, gm, gd } = parseDay(day);
  return d2j(g2d(gy, gm, gd));
}

/** A Jalali date → the Gregorian cafe day (`YYYY-MM-DD`). */
export function fromJalali(jy: number, jm: number, jd: number): string {
  return formatDay(d2g(j2d(jy, jm, jd)));
}

export function isLeapJalaliYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

/** Days in a Jalali month: 31 for Farvardin–Shahrivar, 30 for Mehr–Bahman, 29 or 30 for Esfand. */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

/** A Persian month as an inclusive span of Gregorian cafe days. */
export function jalaliMonthDays(jy: number, jm: number): { fromDay: string; toDay: string } {
  return { fromDay: fromJalali(jy, jm, 1), toDay: fromJalali(jy, jm, jalaliMonthLength(jy, jm)) };
}

/** A fiscal year (1 Farvardin – end of Esfand) as an inclusive span of Gregorian cafe days. */
export function fiscalYearDays(jy: number): { fromDay: string; toDay: string } {
  return { fromDay: fromJalali(jy, 1, 1), toDay: fromJalali(jy, 12, jalaliMonthLength(jy, 12)) };
}

/** The Jalali date of the cafe's "today". */
export function jalaliToday(now: Date): JalaliDate {
  return toJalali(cafeDayOf(now));
}

/**
 * The `count` complete Persian months before the month `today` falls in — the
 * span averages are taken over, so a half-finished month never drags them down.
 */
export function completeMonthsBefore(today: JalaliDate, count: number): { fromDay: string; toDay: string } {
  let jy = today.jy;
  let jm = today.jm - 1;
  if (jm === 0) {
    jy -= 1;
    jm = 12;
  }
  const toDay = jalaliMonthDays(jy, jm).toDay;
  let sy = jy;
  let sm = jm - (count - 1);
  while (sm <= 0) {
    sy -= 1;
    sm += 12;
  }
  return { fromDay: jalaliMonthDays(sy, sm).fromDay, toDay };
}
