"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { fromJalali, jalaliMonthLength, jalaliToday, toJalali } from "@/src/domain/entities/JalaliCalendar";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatYear } from "@/src/presentation/dashboard/accounting/accounting-format";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";

import type { CafeDayFieldProps } from "./CafeDayField";

/** How many years back the year menu reaches. */
const YEARS_BACK = 10;
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

type Draft = { jy: number | null; jm: number | null; jd: number | null };

const EMPTY: Draft = { jy: null, jm: null, jd: null };

function draftOf(value: string): Draft {
  return value ? { ...toJalali(value) } : EMPTY;
}

/**
 * A day on the Persian calendar: a day, a month and a year to choose. The parts are
 * held while the day is half-picked (a month, but no day yet); the value moves only
 * once all three are set, or back to none once all three are cleared.
 */
export function JalaliDayField({ value, onChange, label }: CafeDayFieldProps) {
  const t = useTranslations("dashActivity");
  const tAccounting = useTranslations("dashAccounting");
  const locale = useLocale();
  const thisYear = jalaliToday(new Date()).jy;
  const [draft, setDraft] = React.useState<Draft>(() => draftOf(value));
  const [shown, setShown] = React.useState(value);

  // The value changed from outside (a cleared range): start from it again.
  if (shown !== value) {
    setShown(value);
    setDraft(draftOf(value));
  }

  function update(change: Partial<Draft>): void {
    const next = { ...draft, ...change };
    // A day past the month's end (31 → a 30-day month) moves to its last day.
    if (next.jy && next.jm && next.jd) next.jd = Math.min(next.jd, jalaliMonthLength(next.jy, next.jm));
    setDraft(next);
    if (next.jy && next.jm && next.jd) {
      const day = fromJalali(next.jy, next.jm, next.jd);
      setShown(day);
      onChange(day);
    } else if (!next.jy && !next.jm && !next.jd) {
      setShown("");
      onChange("");
    }
  }

  const days = draft.jy && draft.jm ? jalaliMonthLength(draft.jy, draft.jm) : 31;
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, index) => thisYear - index);
  const asNumber = (raw: string): number | null => (raw ? Number(raw) : null);

  return (
    <fieldset className="flex min-w-0 flex-col">
      <legend className="mb-1.5 text-body-default font-medium text-foreground sm:text-body-small">{label}</legend>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] gap-2">
        <Select
          size="control-md"
          aria-label={t("dayPart.day", { field: label })}
          value={draft.jd ? String(draft.jd) : ""}
          onChange={(event) => update({ jd: asNumber(event.target.value) })}
        >
          <option value="">{t("dayPart.dayPlaceholder")}</option>
          {Array.from({ length: days }, (_, index) => index + 1).map((day) => (
            <option key={day} value={day}>
              {formatNumber(day, locale)}
            </option>
          ))}
        </Select>
        <Select
          size="control-md"
          aria-label={t("dayPart.month", { field: label })}
          value={draft.jm ? String(draft.jm) : ""}
          onChange={(event) => update({ jm: asNumber(event.target.value) })}
        >
          <option value="">{t("dayPart.monthPlaceholder")}</option>
          {MONTHS.map((month) => (
            <option key={month} value={month}>
              {tAccounting(`period.month.${month}`)}
            </option>
          ))}
        </Select>
        <Select
          size="control-md"
          aria-label={t("dayPart.year", { field: label })}
          value={draft.jy ? String(draft.jy) : ""}
          onChange={(event) => update({ jy: asNumber(event.target.value) })}
        >
          <option value="">{t("dayPart.yearPlaceholder")}</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {formatYear(year, locale)}
            </option>
          ))}
        </Select>
      </div>
    </fieldset>
  );
}
