"use client";

import { CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CALENDAR_RANGE_PRESETS, type ReportRangePreset } from "@/src/domain/entities/Analytics";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/presentation/design-system/components/Popover/Popover";

import { ReportRangePanel } from "./ReportRangePanel";

import type { ReportTab } from "./reportLinks";

type ReportRangePickerProps = {
  tab: ReportTab;
  /** Everything in the page's query that should survive a new range (refund timing, ranking). */
  query: Record<string, string>;
  selected: ReportRangePreset | "custom";
  /** The days on screen. */
  fromDay: string;
  toDay: string;
  /** The cafe's today — nothing after it can be picked. */
  today: string;
};

/**
 * The ranges beyond the rolling ones: this week, this month and last month on the
 * reader's calendar, or any span picked on a month grid (Jalali in Persian,
 * Gregorian in English). Whatever is chosen goes into the URL, so the report can be
 * shared or bookmarked as it is. The button names the range when it's one of these.
 */
export function ReportRangePicker({ tab, query, selected, fromDay, toDay, today }: ReportRangePickerProps) {
  const t = useTranslations("dashReports");
  const locale = useLocale();

  const calendarPreset = (CALENDAR_RANGE_PRESETS as readonly string[]).includes(selected);
  const active = selected === "custom" || calendarPreset;
  const label =
    selected === "custom"
      ? fromDay === toDay
        ? formatCafeDayShort(fromDay, locale)
        : t("rangeSpan", { from: formatCafeDayShort(fromDay, locale), to: formatCafeDayShort(toDay, locale) })
      : calendarPreset
        ? t(`preset.${selected}`)
        : t("rangePicker.trigger");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="control-md"
          className={cn("px-3", active && "border-primary")}
          aria-label={active ? t("rangePicker.triggerActive", { range: label }) : undefined}
        >
          <Icon icon={CalendarDays} size="icon-md" className="me-2" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-3">
        <ReportRangePanel
          tab={tab}
          query={query}
          selected={selected}
          fromDay={fromDay}
          toDay={toDay}
          today={today}
          locale={locale}
        />
      </PopoverContent>
    </Popover>
  );
}
