import { getLocale, getTranslations } from "next-intl/server";

import {
  ANALYTICS_RANGE_PRESETS,
  DEFAULT_ANALYTICS_PRESET,
  REFUND_TIMINGS,
  endsBeforeDayEnd,
  type RefundTiming,
  type ReportRangePreset,
} from "@/src/domain/entities/Analytics";
import { inLanguage } from "@/src/domain/entities/CafeSettings";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { ReportTable } from "@/src/domain/use-cases/analytics/Reports";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { cafeSettingsServerApi } from "@/src/presentation/settings/cafe-settings-server-api";

import { DashboardLinkTabs } from "../DashboardLinkTabs";

import { reportsExports } from "./report-api";
import { ReportExportMenu } from "./ReportExportMenu";
import { REPORT_TABS, reportHref, withRange, type ReportTab } from "./reportLinks";
import { ReportPrintButton } from "./ReportPrintButton";
import { ReportRangePicker } from "./ReportRangePicker";
import { ReportSegmentedLinks } from "./ReportSegmentedLinks";

import type { ReportRangeWire } from "./report-response-schema";
import type { ReactNode } from "react";

type ReportsFrameProps = {
  tab: ReportTab;
  /** The range option in force, or `"custom"` for a span given in the URL. */
  selected: ReportRangePreset | "custom";
  /** The page's range and refund-timing params, carried across the tabs. */
  rangeQuery: Record<string, string>;
  /** This tab's own params, kept when the range changes (the best-sellers ranking). */
  keep?: Record<string, string>;
  range: ReportRangeWire;
  /** The period before the range — what the figures are compared with — named after it. */
  previousRange?: ReportRangeWire;
  /** When refunds count on this report; the switch shows only where refunds move the figures. */
  refunds?: RefundTiming;
  /** The tables the report downloads as CSV, in the order the menu lists them. */
  exports: readonly ReportTable[];
  children: ReactNode;
};

/**
 * What every report shares: the heading, the CSV export and print, the range
 * switch and picker, the Sales / Payments / Guests tabs, a line saying which days
 * are on screen (and what they're compared with), and — where refunds move the
 * figures — when refunds count. Every switch is a link, so the server render
 * re-runs the report and the URL can be shared as it stands.
 *
 * On paper the controls drop away, the cafe's name heads the page with the report
 * and its dates, and the panels stack in one column (see the screens).
 */
export async function ReportsFrame({
  tab,
  selected,
  rangeQuery,
  keep = {},
  range,
  previousRange,
  refunds,
  exports,
  children,
}: ReportsFrameProps) {
  const [t, tMeta, locale, settings] = await Promise.all([
    getTranslations("dashReports"),
    getTranslations("meta"),
    getLocale(),
    cafeSettingsServerApi.getOrEmpty(),
  ]);
  // The printed page is headed with the cafe's own name (Settings), the site's until one is set.
  const cafeName = inLanguage(locale, settings.profile.name, settings.profile.nameFa) ?? tMeta("siteName");

  const day = (value: string): string => formatCafeDayShort(value, locale);
  const span = (value: ReportRangeWire): string =>
    value.fromDay === value.toDay
      ? day(value.fromDay)
      : t("rangeSpan", { from: day(value.fromDay), to: day(value.toDay) });
  const today = selected === "today";
  const shown = today ? t("rangeToday", { day: day(range.toDay) }) : span(range);
  // A day still in progress is compared with the day before up to the same time.
  const atThisTime =
    previousRange !== undefined && endsBeforeDayEnd({ toDay: previousRange.toDay, to: new Date(previousRange.to) });
  const compared = !previousRange
    ? null
    : today
      ? t("comparedWithYesterday")
      : atThisTime
        ? t("comparedWithAtThisTime", { span: span(previousRange) })
        : t("comparedWith", { span: span(previousRange) });

  const query = { ...rangeQuery, ...keep };
  const { refunds: _refunds, ...withoutRefunds } = query;
  const exportParams = { ...query, locale };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="hidden text-body-small font-semibold text-muted-foreground print:block">
            {t("printHeading", { cafe: cafeName, report: t(`tab.${tab}`) })}
          </p>
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small print:hidden">
            {t("summary")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <ReportExportMenu
            label={t("export.csv")}
            items={exports.map((table) => ({
              key: table,
              label: t(`export.table.${table}`),
              href: reportsExports.tableHref(table, exportParams),
            }))}
          />
          <ReportPrintButton label={t("export.print")} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <ReportSegmentedLinks
          label={t("rangeLabel")}
          current={selected}
          options={ANALYTICS_RANGE_PRESETS.map((preset) => ({
            key: preset,
            label: t(`preset.${preset}`),
            href: reportHref(tab, withRange(query, preset === DEFAULT_ANALYTICS_PRESET ? {} : { range: preset })),
          }))}
        />
        <ReportRangePicker
          tab={tab}
          query={query}
          selected={selected}
          fromDay={range.fromDay}
          toDay={range.toDay}
          today={cafeDayOf(new Date())}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="print:hidden">
          <DashboardLinkTabs
            label={t("tabsLabel")}
            current={tab}
            tabs={REPORT_TABS.map((key) => ({ key, label: t(`tab.${key}`), href: reportHref(key, rangeQuery) }))}
          />
        </div>
        <p className="text-body-small text-muted-foreground sm:text-body-caption print:text-body-small print:text-foreground">
          {compared ? `${shown} · ${compared}` : shown}
          {refunds ? <span className="hidden print:inline"> · {t(`refunds.printed.${refunds}`)}</span> : null}
        </p>
        {refunds ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
            <span aria-hidden className="text-body-small font-medium text-foreground sm:text-body-caption">
              {t("refunds.label")}
            </span>
            <ReportSegmentedLinks
              label={t("refunds.label")}
              current={refunds}
              options={REFUND_TIMINGS.map((timing) => ({
                key: timing,
                label: t(`refunds.option.${timing}`),
                href: reportHref(tab, timing === "orderDay" ? withoutRefunds : { ...withoutRefunds, refunds: timing }),
              }))}
            />
            <p className="basis-full text-body-small text-pretty text-muted-foreground sm:text-body-caption">
              {t(`refunds.hint.${refunds}`)}
            </p>
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
