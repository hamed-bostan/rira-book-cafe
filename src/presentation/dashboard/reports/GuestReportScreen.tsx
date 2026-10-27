import { CalendarDays, Repeat, UserPlus, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { AnalyticsRangePreset } from "@/src/domain/entities/Analytics";
import { cafeDaysBetween } from "@/src/domain/entities/CafeTime";
import { formatPercent } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Avatar } from "@/src/presentation/design-system/components/Avatar/Avatar";

import { MetricCard, type MetricCardTone } from "../MetricCard";

import { changeOf, formatChange } from "./reportFormat";
import { ReportPanel } from "./ReportPanel";
import { ReportsFrame } from "./ReportsFrame";

import type { GuestReportWire } from "./report-response-schema";

const DAYS_PER_WEEK = 7;

type GuestReportScreenProps = {
  report: GuestReportWire;
  selected: AnalyticsRangePreset | "custom";
  /** The page's range params, carried across the tabs. */
  rangeQuery: Record<string, string>;
};

/**
 * The Guests tab: who came against the period before, how many were new and how
 * many came back, how bookings went, and the regulars who spent the most.
 * Presentational — the page fetches over the BFF.
 */
export async function GuestReportScreen({ report, selected, rangeQuery }: GuestReportScreenProps) {
  const t = await getTranslations("dashReports");
  const locale = await getLocale();
  const { reservations } = report;

  const moved = changeOf(report.guests, report.previousGuests);
  const guestsChange: { hint: string; hintTone?: MetricCardTone } = moved
    ? {
        hint: t(moved.up ? "changeUp" : "changeDown", { value: formatChange(moved.share, locale) }),
        hintTone: moved.up ? "success" : "danger",
      }
    : { hint: t("noBaseline") };
  // A range short of a week says nothing about who keeps coming back.
  const regularsShown = cafeDaysBetween(report.range.fromDay, report.range.toDay) + 1 >= DAYS_PER_WEEK;

  return (
    <ReportsFrame
      tab="guests"
      selected={selected}
      rangeQuery={rangeQuery}
      range={report.range}
      previousRange={report.previousRange}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("guests.guests")}
          icon={Users}
          value={formatNumber(report.guests, locale)}
          {...guestsChange}
        />
        <MetricCard
          label={t("guests.newGuests")}
          icon={UserPlus}
          value={formatNumber(report.newGuests, locale)}
          hint={t("guests.returning", {
            count: report.returningGuests,
            formatted: formatNumber(report.returningGuests, locale),
          })}
        />
        <MetricCard
          label={t("guests.repeatRate")}
          icon={Repeat}
          value={formatPercent(report.repeatRate, locale)}
          hint={t("guests.repeatRateHint")}
        />
        <MetricCard
          label={t("guests.bookings")}
          icon={CalendarDays}
          value={formatNumber(reservations.total, locale)}
          hint={t("guests.bookingsHint", {
            covers: formatNumber(reservations.covers, locale),
            noShowRate: formatPercent(reservations.noShowRate, locale),
          })}
        />
      </div>

      <ReportPanel
        title={t("guests.topGuestsHeading")}
        description={t("guests.topGuestsDescription")}
        className="gap-2"
      >
        {!regularsShown ? (
          <p className="text-body-default text-muted-foreground sm:text-body-small">{t("guests.pickLonger")}</p>
        ) : report.topGuests.length === 0 ? (
          <p className="text-body-default text-muted-foreground sm:text-body-small">{t("noSales")}</p>
        ) : (
          <ol>
            {report.topGuests.map((guest, index) => (
              <li
                key={guest.userId}
                className={cn("flex items-center gap-3 py-3", index > 0 && "border-t border-border")}
              >
                <Avatar name={guest.name} className="size-10 text-body-small font-bold" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    dir="auto"
                    className="text-body-strong [overflow-wrap:anywhere] text-foreground sm:text-body-small-strong"
                  >
                    {guest.name}
                  </span>
                  <span className="text-body-small text-muted-foreground sm:text-body-caption">
                    {t("guests.visits", { count: guest.orders, formatted: formatNumber(guest.orders, locale) })}
                  </span>
                </span>
                <span className="text-body-strong whitespace-nowrap text-foreground tabular-nums sm:text-body-small-strong">
                  {formatMoney(guest.revenue, locale)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </ReportPanel>
    </ReportsFrame>
  );
}
