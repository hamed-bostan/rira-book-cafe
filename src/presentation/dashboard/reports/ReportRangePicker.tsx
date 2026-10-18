"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import {
  ANALYTICS_RANGE_PRESETS,
  DEFAULT_ANALYTICS_PRESET,
  type AnalyticsRangePreset,
} from "@/src/domain/entities/Analytics";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

type ReportRangePickerProps = {
  /** The highlighted option. */
  selected: AnalyticsRangePreset | "custom";
  /** The range on screen, as cafe days — prefills the custom fields. */
  fromDay: string;
  toDay: string;
  /** Other query params to keep (e.g. the top-items sort). */
  keep: Record<string, string>;
};

/**
 * Preset chips (Today, 7 days, 30 days, 90 days) plus a custom span of cafe days.
 * Every choice is just a URL change, so the server render re-runs the report.
 */
export function ReportRangePicker({ selected, fromDay, toDay, keep }: ReportRangePickerProps) {
  const t = useTranslations("dashReports");
  const router = useRouter();
  const pathname = usePathname();
  const [custom, setCustom] = React.useState(selected === "custom");
  const [from, setFrom] = React.useState(fromDay);
  const [to, setTo] = React.useState(toDay);

  function navigate(params: Record<string, string>): void {
    const query = new URLSearchParams({ ...keep, ...params });
    const qs = query.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function choosePreset(preset: AnalyticsRangePreset): void {
    setCustom(false);
    navigate(preset === DEFAULT_ANALYTICS_PRESET ? {} : { range: preset });
  }

  const chip = (active: boolean) =>
    cn(
      "flex h-9 items-center rounded-full border px-4 text-button-default-medium transition-colors",
      focusRing,
      active ? "border-primary bg-accent text-primary" : "border-border text-foreground hover:bg-muted",
    );

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t("rangeLabel")} className="flex flex-wrap gap-2">
        {ANALYTICS_RANGE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={!custom && selected === preset}
            className={chip(!custom && selected === preset)}
            onClick={() => choosePreset(preset)}
          >
            {t(`preset.${preset}`)}
          </button>
        ))}
        <button type="button" aria-pressed={custom} className={chip(custom)} onClick={() => setCustom(true)}>
          {t("presetCustom")}
        </button>
      </div>
      {custom ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (from && to && from <= to) navigate({ from, to });
          }}
        >
          <label className="flex flex-col gap-1 text-body-caption text-muted-foreground">
            {t("rangeFrom")}
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="h-9"
              dir="ltr"
            />
          </label>
          <label className="flex flex-col gap-1 text-body-caption text-muted-foreground">
            {t("rangeTo")}
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="h-9"
              dir="ltr"
            />
          </label>
          <Button type="submit" size="sm" disabled={!from || !to || from > to}>
            {t("apply")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
