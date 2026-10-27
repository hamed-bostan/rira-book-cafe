import { getLocale, getTranslations } from "next-intl/server";

import {
  ANALYTICS_RANGE_PRESETS,
  DEFAULT_ANALYTICS_PRESET,
  type AnalyticsRangePreset,
} from "@/src/domain/entities/Analytics";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";

import { DashboardLinkTabs } from "../DashboardLinkTabs";

import { REPORT_TABS, reportHref, type ReportTab } from "./reportLinks";
import { ReportSegmentedLinks } from "./ReportSegmentedLinks";

import type { ReportRangeWire } from "./report-response-schema";
import type { ReactNode } from "react";

type ReportsFrameProps = {
  tab: ReportTab;
  /** The range option in force, or `"custom"` for a span given in the URL. */
  selected: AnalyticsRangePreset | "custom";
  /** The page's range params (`range`, or `from` and `to`), carried across the tabs. */
  rangeQuery: Record<string, string>;
  /** This tab's own params, kept when the range changes (the best-sellers ranking). */
  keep?: Record<string, string>;
  range: ReportRangeWire;
  /** The period the tab's figures are compared with, when it compares. */
  previousRange?: ReportRangeWire;
  children: ReactNode;
};

/**
 * What every report shares: the heading, the range switch, the Sales / Payments /
 * Guests tabs and a line saying which days are on screen (and what they're
 * compared with). Every switch is a link, so the server render re-runs the report.
 */
export async function ReportsFrame({
  tab,
  selected,
  rangeQuery,
  keep = {},
  range,
  previousRange,
  children,
}: ReportsFrameProps) {
  const t = await getTranslations("dashReports");
  const locale = await getLocale();

  const day = (value: string): string => formatCafeDayShort(value, locale);
  const span = (value: ReportRangeWire): string =>
    value.fromDay === value.toDay
      ? day(value.fromDay)
      : t("rangeSpan", { from: day(value.fromDay), to: day(value.toDay) });
  const today = selected === "today";
  const shown = today ? t("rangeToday", { day: day(range.toDay) }) : span(range);
  const compared = previousRange
    ? today
      ? t("comparedWithYesterday")
      : t("comparedWith", { span: span(previousRange) })
    : null;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("summary")}</p>
        </div>
        <ReportSegmentedLinks
          label={t("rangeLabel")}
          current={selected}
          options={ANALYTICS_RANGE_PRESETS.map((preset) => ({
            key: preset,
            label: t(`preset.${preset}`),
            href: reportHref(tab, { ...(preset === DEFAULT_ANALYTICS_PRESET ? {} : { range: preset }), ...keep }),
          }))}
        />
      </div>

      <div className="flex flex-col gap-3">
        <DashboardLinkTabs
          label={t("tabsLabel")}
          current={tab}
          tabs={REPORT_TABS.map((key) => ({ key, label: t(`tab.${key}`), href: reportHref(key, rangeQuery) }))}
        />
        <p className="text-body-small text-muted-foreground sm:text-body-caption">
          {compared ? `${shown} · ${compared}` : shown}
        </p>
      </div>

      {children}
    </div>
  );
}
