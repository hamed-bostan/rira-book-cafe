"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  CALENDAR_RANGE_PRESETS,
  MAX_RANGE_DAYS,
  calendarForLocale,
  type ReportRangePreset,
} from "@/src/domain/entities/Analytics";
import { cafeDaysBetween } from "@/src/domain/entities/CafeTime";
import { Link, useRouter } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/routing";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { PopoverClose } from "@/src/presentation/design-system/components/Popover/Popover";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { pickDay } from "./calendarGrid";
import { RangeCalendar } from "./RangeCalendar";
import { reportHref, withRange, type ReportTab } from "./reportLinks";

type ReportRangePanelProps = {
  tab: ReportTab;
  /** Everything in the page's query that should survive a new range (refund timing, ranking). */
  query: Record<string, string>;
  selected: ReportRangePreset | "custom";
  fromDay: string;
  toDay: string;
  /** The cafe's today — nothing after it can be picked. */
  today: string;
  locale: Locale;
};

/**
 * The range picker's panel: the calendar presets, then a month grid to pick any
 * span on. The picked span lives here, inside the panel: Radix mounts it only while
 * open, so each opening starts from the range on screen rather than from a
 * half-picked span left behind.
 */
export function ReportRangePanel({ tab, query, selected, fromDay, toDay, today, locale }: ReportRangePanelProps) {
  const t = useTranslations("dashReports");
  const router = useRouter();
  const [draft, setDraft] = React.useState<{ from: string | null; to: string | null }>(() =>
    selected === "custom" ? { from: fromDay, to: toDay } : { from: null, to: null },
  );
  const days = draft.from && draft.to ? cafeDaysBetween(draft.from, draft.to) + 1 : 0;
  const tooLong = days > MAX_RANGE_DAYS;

  const status = !draft.from
    ? t("rangePicker.pickStart")
    : !draft.to
      ? t("rangePicker.pickEnd", { day: formatCafeDayMedium(draft.from, locale) })
      : tooLong
        ? t("rangePicker.tooLong", { days: MAX_RANGE_DAYS })
        : t("rangeSpan", {
            from: formatCafeDayMedium(draft.from, locale),
            to: formatCafeDayMedium(draft.to, locale),
          });

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label={t("rangePicker.presetsLabel")} className="flex flex-col">
        {CALENDAR_RANGE_PRESETS.map((preset) => (
          <PopoverClose key={preset} asChild>
            <Link
              href={reportHref(tab, withRange(query, { range: preset }))}
              scroll={false}
              aria-current={selected === preset ? "true" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2 rounded-button px-2 text-body-default text-foreground transition-colors hover:bg-muted sm:min-h-9 sm:text-body-small",
                focusRing,
                selected === preset && "font-semibold",
              )}
            >
              {t(`preset.${preset}`)}
              {selected === preset ? <Icon icon={Check} size="icon-md" className="text-primary" /> : null}
            </Link>
          </PopoverClose>
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-body-small-strong text-foreground">{t("rangePicker.customHeading")}</p>
        <RangeCalendar
          calendar={calendarForLocale(locale)}
          locale={locale}
          from={draft.from}
          to={draft.to}
          max={today}
          labels={{ previousMonth: t("rangePicker.previousMonth"), nextMonth: t("rangePicker.nextMonth") }}
          onPick={(day) => setDraft((current) => pickDay(current, day))}
        />
        <p
          aria-live="polite"
          className={cn(
            "text-body-small sm:text-body-caption",
            tooLong ? "text-error-foreground" : "text-muted-foreground",
          )}
        >
          {status}
        </p>
        <PopoverClose asChild>
          <Button
            type="button"
            size="control-md"
            disabled={!draft.from || !draft.to || tooLong}
            onClick={() => {
              if (!draft.from || !draft.to) return;
              router.push(reportHref(tab, withRange(query, { from: draft.from, to: draft.to })), { scroll: false });
            }}
          >
            {t("rangePicker.apply")}
          </Button>
        </PopoverClose>
      </div>
    </div>
  );
}
