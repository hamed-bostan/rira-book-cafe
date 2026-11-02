import { jalaliMonthDays, parseJalaliPeriod } from "@/src/domain/entities/JalaliCalendar";
import type { Locale } from "@/src/i18n/routing";
import { formatYear } from "@/src/presentation/dashboard/accounting/accounting-format";
import { formatPersianMonth } from "@/src/presentation/dashboard/expenses/expenseFormat";

/** A pay run's month in the reader's language: "Aban 1405" / «آبان ۱۴۰۵». */
export function formatPayPeriod(period: string, locale: Locale): string {
  const month = parseJalaliPeriod(period);
  if (!month) return period;
  return `${formatPersianMonth(jalaliMonthDays(month.jy, month.jm).fromDay, locale)} ${formatYear(month.jy, locale)}`;
}
