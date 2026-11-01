"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { fiscalYearDays, jalaliMonthDays, jalaliToday, toJalali } from "@/src/domain/entities/JalaliCalendar";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";

import { DashboardField } from "../DashboardField";
import { FIELD_INPUT } from "../fieldStyles";
import { ROW_CAPTION } from "../pageStyles";

import { formatYear } from "./accounting-format";

type PeriodPickerProps = {
  /** The span on screen. */
  fromDay: string;
  toDay: string;
  /** Other query params to keep when the period changes (filters). Paging resets. */
  keep?: Record<string, string>;
};

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
/** How many fiscal years back the year menu reaches. */
const YEARS_BACK = 5;

/** Which preset (a month, the whole year) the span is exactly, if any. */
function presetOf(fromDay: string, toDay: string): { year: number; period: string } | null {
  const start = toJalali(fromDay);
  const year = fiscalYearDays(start.jy);
  if (year.fromDay === fromDay && year.toDay === toDay) return { year: start.jy, period: "year" };
  const month = jalaliMonthDays(start.jy, start.jm);
  if (month.fromDay === fromDay && month.toDay === toDay) return { year: start.jy, period: String(start.jm) };
  return null;
}

/**
 * The accounting period, on the Persian calendar: a month of a fiscal year (which
 * starts on 1 Farvardin), the whole year, or any span of days. Every choice is a
 * URL change — the server render re-reads the books.
 */
export function PeriodPicker({ fromDay, toDay, keep = {} }: PeriodPickerProps) {
  const t = useTranslations("dashAccounting");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const preset = presetOf(fromDay, toDay);
  const thisYear = jalaliToday(new Date()).jy;

  const [year, setYear] = React.useState(preset?.year ?? toJalali(fromDay).jy);
  const [period, setPeriod] = React.useState(preset?.period ?? "custom");
  const [from, setFrom] = React.useState(fromDay);
  const [to, setTo] = React.useState(toDay);

  function navigate(span: { fromDay: string; toDay: string }): void {
    const query = new URLSearchParams({ ...keep, from: span.fromDay, to: span.toDay });
    router.push(`${pathname}?${query.toString()}`);
  }

  function choose(nextYear: number, nextPeriod: string): void {
    setYear(nextYear);
    setPeriod(nextPeriod);
    if (nextPeriod === "custom") return;
    navigate(nextPeriod === "year" ? fiscalYearDays(nextYear) : jalaliMonthDays(nextYear, Number(nextPeriod)));
  }

  const years = Array.from({ length: YEARS_BACK + 1 }, (_, index) => thisYear - index);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <DashboardField label={t("period.fiscalYearLabel")}>
          <Select
            size="control-md"
            className="w-auto min-w-32 border-border-strong"
            value={String(year)}
            onChange={(event) => choose(Number(event.target.value), period === "custom" ? "year" : period)}
          >
            {years.map((option) => (
              <option key={option} value={option}>
                {formatYear(option, locale)}
              </option>
            ))}
          </Select>
        </DashboardField>
        <DashboardField label={t("period.periodLabel")}>
          <Select
            size="control-md"
            className="w-auto min-w-40 border-border-strong"
            value={period}
            onChange={(event) => choose(year, event.target.value)}
          >
            <option value="year">{t("period.wholeYear")}</option>
            {MONTHS.map((month) => (
              <option key={month} value={String(month)}>
                {t(`period.month.${month}`)}
              </option>
            ))}
            <option value="custom">{t("period.custom")}</option>
          </Select>
        </DashboardField>

        {period === "custom" ? (
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              if (from && to && from <= to) navigate({ fromDay: from, toDay: to });
            }}
          >
            <DashboardField label={t("period.from")}>
              <Input
                size="control-md"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                className="w-auto"
                inputClassName={FIELD_INPUT}
                dir="ltr"
              />
            </DashboardField>
            <DashboardField label={t("period.to")}>
              <Input
                size="control-md"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                className="w-auto"
                inputClassName={FIELD_INPUT}
                dir="ltr"
              />
            </DashboardField>
            <Button
              type="submit"
              variant="secondary"
              size="control-md"
              className="px-3"
              disabled={!from || !to || from > to}
            >
              {t("period.apply")}
            </Button>
          </form>
        ) : null}
      </div>

      <p className={ROW_CAPTION}>
        {t("period.caption", { from: formatCafeDayMedium(fromDay, locale), to: formatCafeDayMedium(toDay, locale) })}
        {toDay > cafeDayOf(new Date()) ? ` · ${t("period.toDate")}` : null}
      </p>
    </div>
  );
}
