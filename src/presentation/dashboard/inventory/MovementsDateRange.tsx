"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";

import { DashboardField } from "../DashboardField";
import { FIELD_INPUT } from "../fieldStyles";
import { useListParams } from "../list/useListParams";
import { ROW_CAPTION } from "../pageStyles";

import { MOVEMENT_RANGE_PRESETS, presetOf, rangeForPreset, type MovementRangePreset } from "./movementRange";

type MovementsDateRangeProps = {
  /** The span on screen, from the query string. */
  from?: string;
  to?: string;
  /** Today on the cafe calendar. */
  today: string;
};

/**
 * The movements' dates: all of them, this month or last (Persian months in
 * Persian, as the books are kept), the last 30 days, or any two days. The days
 * picked read back on the reader's calendar under the controls. Every choice is a
 * URL change — the server render reads the movements again, from page 1.
 */
export function MovementsDateRange({ from, to, today }: MovementsDateRangeProps) {
  const t = useTranslations("dashInventory.movements.range");
  const locale = useLocale();
  const calendar = locale === "fa" ? "jalali" : "gregorian";
  const searchParams = useSearchParams();
  const { setParams } = useListParams();
  const current = presetOf({ from, to }, today, calendar);

  const [preset, setPreset] = React.useState<MovementRangePreset>(current);
  const [fromDay, setFromDay] = React.useState(from ?? "");
  const [toDay, setToDay] = React.useState(to ?? "");

  function apply(range: { from?: string; to?: string }): void {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(range)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    setParams(next);
  }

  function choose(value: string): void {
    const next = [...MOVEMENT_RANGE_PRESETS, "custom" as const].find((option) => option === value) ?? "all";
    setPreset(next);
    if (next !== "custom") apply(rangeForPreset(next, today, calendar));
  }

  const caption =
    from && to
      ? t("between", { from: formatCafeDayMedium(from, locale), to: formatCafeDayMedium(to, locale) })
      : from
        ? t("since", { from: formatCafeDayMedium(from, locale) })
        : to
          ? t("until", { to: formatCafeDayMedium(to, locale) })
          : t("allTime");

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        <DashboardField label={t("label")}>
          <Select
            size="control-md"
            className="w-auto min-w-40 border-border-strong"
            value={preset}
            onChange={(event) => choose(event.target.value)}
          >
            {MOVEMENT_RANGE_PRESETS.map((option) => (
              <option key={option} value={option}>
                {t(`preset.${option}`)}
              </option>
            ))}
            <option value="custom">{t("preset.custom")}</option>
          </Select>
        </DashboardField>
        {preset === "custom" ? (
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              if (!fromDay || !toDay || fromDay <= toDay) apply({ from: fromDay, to: toDay });
            }}
          >
            <DashboardField label={t("from")}>
              <Input
                size="control-md"
                type="date"
                value={fromDay}
                max={toDay || today}
                onChange={(event) => setFromDay(event.target.value)}
                className="w-auto"
                inputClassName={FIELD_INPUT}
                dir="ltr"
              />
            </DashboardField>
            <DashboardField label={t("to")}>
              <Input
                size="control-md"
                type="date"
                value={toDay}
                min={fromDay || undefined}
                max={today}
                onChange={(event) => setToDay(event.target.value)}
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
              disabled={Boolean(fromDay && toDay && fromDay > toDay)}
            >
              {t("apply")}
            </Button>
          </form>
        ) : null}
      </div>
      <p className={ROW_CAPTION}>{caption}</p>
    </div>
  );
}
