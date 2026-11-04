"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import type { ReportCalendar } from "@/src/domain/entities/Analytics";
import { CAFE_TIME_ZONE, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Locale } from "@/src/i18n/routing";
import { formatCafeDayFull, formatCafeDayHeader } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import {
  calendarMonthOf,
  dayOfMonth,
  monthBounds,
  monthWeeks,
  noonOf,
  shiftMonth,
  weekdayColumns,
  type CalendarMonth,
} from "./calendarGrid";

type RangeCalendarProps = {
  calendar: ReportCalendar;
  locale: Locale;
  /** The span picked so far; `to` is `null` while only its first day is. */
  from: string | null;
  to: string | null;
  /** The last day that can be picked — today: a report has nothing after it. */
  max: string;
  onPick: (day: string) => void;
  labels: { previousMonth: string; nextMonth: string };
};

const MONTH_TAG: Record<Locale, string> = { en: "en-US", fa: "fa-IR-u-ca-persian" };

/** Arrow keys move a day or a week; the inline direction follows the page's. */
const KEY_STEP: Record<string, number> = { ArrowUp: -7, ArrowDown: 7 };

/**
 * A month of days to pick a span from, on the reader's calendar — Jalali months in
 * Persian, Gregorian in English — with weeks starting on Saturday. One click starts
 * the span, the next ends it; the days between are shaded.
 *
 * One day button is in the tab order at a time (the focused one); the arrow keys
 * move between days and turn the month at its edges, as a date grid does.
 */
export function RangeCalendar({ calendar, locale, from, to, max, onPick, labels }: RangeCalendarProps) {
  const [month, setMonth] = React.useState<CalendarMonth>(() => calendarMonthOf(to ?? from ?? max, calendar));
  const [focused, setFocused] = React.useState<string>(() => to ?? from ?? max);
  const grid = React.useRef<HTMLTableElement>(null);
  const moveFocus = React.useRef(false);

  const title = new Intl.DateTimeFormat(MONTH_TAG[locale], {
    month: "long",
    year: "numeric",
    timeZone: CAFE_TIME_ZONE,
  }).format(noonOf(monthBounds(month, calendar).first));
  const atLatest = monthBounds(month, calendar).last >= max;

  React.useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [focused, month]);

  function focusDay(day: string): void {
    const target = day > max ? max : day;
    moveFocus.current = true;
    setFocused(target);
    const { first, last } = monthBounds(month, calendar);
    if (target < first || target > last) setMonth(calendarMonthOf(target, calendar));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, day: string): void {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const inline = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const step = KEY_STEP[event.key] ?? (inline === 0 ? 0 : rtl ? -inline : inline);
    if (step !== 0) {
      event.preventDefault();
      focusDay(shiftCafeDay(day, step));
    }
  }

  function turn(offset: number): void {
    const next = shiftMonth(month, offset);
    setMonth(next);
    const { first, last } = monthBounds(next, calendar);
    setFocused(last > max ? max : first);
  }

  const inSpan = (day: string): boolean => (from !== null && to !== null ? day >= from && day <= to : day === from);
  const isEnd = (day: string): boolean => day === from || day === to;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="control-sm"
          iconOnly
          aria-label={labels.previousMonth}
          onClick={() => turn(-1)}
        >
          <Icon icon={ChevronLeft} size="icon-md" className="rtl:rotate-180" />
        </Button>
        <p aria-live="polite" className="text-body-small-strong text-foreground">
          {title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="control-sm"
          iconOnly
          aria-label={labels.nextMonth}
          disabled={atLatest}
          onClick={() => turn(1)}
        >
          <Icon icon={ChevronRight} size="icon-md" className="rtl:rotate-180" />
        </Button>
      </div>

      <table ref={grid} className="w-full table-fixed border-collapse text-center">
        <thead>
          <tr>
            {weekdayColumns().map((day) => (
              <th
                key={day}
                scope="col"
                className="pb-1 text-body-caption font-medium text-muted-foreground"
                abbr={formatCafeDayFull(day, locale).split(/[,،]/)[0]}
              >
                {formatCafeDayHeader(day, locale).weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(month, calendar).map((week, row) => (
            <tr key={row}>
              {week.map((day, column) => (
                <td key={day ?? `blank-${row}-${column}`} className="p-0">
                  {day ? (
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={day === focused ? 0 : -1}
                      disabled={day > max}
                      aria-pressed={inSpan(day)}
                      aria-label={formatCafeDayFull(day, locale)}
                      onClick={() => {
                        setFocused(day);
                        onPick(day);
                      }}
                      onKeyDown={(event) => onKeyDown(event, day)}
                      className={cn(
                        "h-11 w-full text-body-default tabular-nums transition-colors sm:h-9 sm:text-body-small",
                        focusRing,
                        "disabled:cursor-not-allowed disabled:text-muted-foreground/50",
                        inSpan(day) ? "bg-primary/15 text-foreground" : "text-foreground hover:bg-muted",
                        isEnd(day) &&
                          "rounded-button bg-primary font-semibold text-primary-foreground hover:bg-primary",
                      )}
                    >
                      {formatNumber(dayOfMonth(day, calendar), locale)}
                    </button>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
