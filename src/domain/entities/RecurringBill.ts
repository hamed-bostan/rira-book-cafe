import { fromJalali, jalaliMonthLength, toJalali } from "./JalaliCalendar";

/**
 * A bill that comes round every Persian month: rent, internet, a service contract.
 *
 * Nothing is booked on its own. When a month falls due it's put in front of someone,
 * who records it, with the amount as it really came, or skips it. Journal entries
 * can only be reversed, never edited, so a person sees each one before it reaches
 * the books.
 */
export type RecurringBill = {
  id: string;
  description: string;
  /** The account it's booked to, as for any expense. */
  accountCode: string;
  supplierId?: string;
  supplierName?: string;
  /** The usual total, VAT included, in whole Toman. It can be changed when it's recorded. */
  amount: number;
  /** The VAT inside `amount`. */
  vatAmount: number;
  /** The day of the Persian month it falls due; a shorter month uses its last day. */
  dayOfMonth: number;
  /** The cafe day it was set up. Months before this owe nothing, so a new bill asks nothing of the past. */
  startsOn: string;
  isActive: boolean;
  createdAt: string;
};

export const MAX_BILL_DAY = 31;

/** A month of a bill waiting for someone to deal with it. */
export type DueBill = {
  bill: RecurringBill;
  /** The Persian month, "1405-08". */
  period: string;
  dueOn: string;
};

const BILL_PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isBillPeriod(value: string): boolean {
  return BILL_PERIOD.test(value);
}

const periodOf = (jy: number, jm: number): string => `${jy}-${String(jm).padStart(2, "0")}`;

function dueDayIn(dayOfMonth: number, jy: number, jm: number): string {
  return fromJalali(jy, jm, Math.min(dayOfMonth, jalaliMonthLength(jy, jm)));
}

/** Whether a bill owes this month as of today: the month has fallen due, and not before the bill existed. */
export function isDuePeriod(
  bill: Pick<RecurringBill, "dayOfMonth" | "startsOn" | "isActive">,
  period: string,
  today: string,
): boolean {
  const match = BILL_PERIOD.exec(period);
  if (!match || !bill.isActive) return false;
  const dueOn = dueDayIn(bill.dayOfMonth, Number(match[1]), Number(match[2]));
  return dueOn >= bill.startsOn && dueOn <= today;
}

/**
 * Every month a bill owes and nobody has dealt with, oldest first. A month that was
 * missed stays here until someone records or skips it, so it can't slip by unseen.
 */
export function dueMonths(bill: RecurringBill, done: ReadonlySet<string>, today: string): DueBill[] {
  const due: DueBill[] = [];
  const end = toJalali(today);
  let { jy, jm } = toJalali(bill.startsOn);
  while (jy < end.jy || (jy === end.jy && jm <= end.jm)) {
    const period = periodOf(jy, jm);
    if (!done.has(period) && isDuePeriod(bill, period, today)) {
      due.push({ bill, period, dueOn: dueDayIn(bill.dayOfMonth, jy, jm) });
    }
    jy = jm === 12 ? jy + 1 : jy;
    jm = jm === 12 ? 1 : jm + 1;
  }
  return due;
}
