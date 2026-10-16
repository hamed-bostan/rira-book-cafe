import { CalendarCheck, PartyPopper, Repeat, UserPlus, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { AnalyticsRangePreset } from "@/src/domain/entities/Analytics";
import { formatPercent } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { maskPhoneNumber } from "@/src/lib/maskPhoneNumber";

import { StatCard } from "../StatCard";

import { ReportHeader } from "./ReportHeader";

import type { GuestReportWire } from "./report-response-schema";

type GuestReportScreenProps = {
  report: GuestReportWire;
  selected: AnalyticsRangePreset | "custom";
};

/** Who came and how often, the best regulars, and how bookings and events went. */
export async function GuestReportScreen({ report, selected }: GuestReportScreenProps) {
  const t = await getTranslations("dashReports");
  const locale = await getLocale();
  const { reservations, events } = report;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ReportHeader title={t("guests.title")} subtitle={t("guests.subtitle")} range={report.range} selected={selected} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("guests.guests")} value={formatNumber(report.guests, locale)} icon={Users} tone="brand" />
        <StatCard
          label={t("guests.newGuests")}
          value={formatNumber(report.newGuests, locale)}
          hint={t("guests.returning", { count: report.returningGuests, formatted: formatNumber(report.returningGuests, locale) })}
          icon={UserPlus}
          tone="info"
        />
        <StatCard
          label={t("guests.repeatRate")}
          value={formatPercent(report.repeatRate, locale)}
          hint={t("guests.repeatRateHint")}
          icon={Repeat}
          tone="info"
        />
        <StatCard
          label={t("guests.bookings")}
          value={formatNumber(reservations.total, locale)}
          hint={t("guests.bookingsHint", {
            covers: formatNumber(reservations.covers, locale),
            noShowRate: formatPercent(reservations.noShowRate, locale),
          })}
          icon={CalendarCheck}
          tone={reservations.noShowRate > 0.15 ? "warning" : "brand"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-card-lg border border-border bg-background p-4 md:p-6">
          <h2 className="text-body-lead text-foreground">{t("guests.topGuestsHeading")}</h2>
          {report.topGuests.length === 0 ? (
            <p className="py-8 text-center text-body-small-emphasis text-muted-foreground">{t("noSales")}</p>
          ) : (
            <ol className="mt-4 flex flex-col divide-y divide-border">
              {report.topGuests.map((guest, index) => (
                <li key={guest.userId} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 shrink-0 text-body-small tabular-nums text-muted-foreground">{formatNumber(index + 1, locale)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-small-strong text-foreground">{guest.name}</span>
                    <span dir="ltr" className="text-body-caption text-muted-foreground">{maskPhoneNumber(guest.phone)}</span>
                  </span>
                  <span className="text-end">
                    <span className="block text-body-small-emphasis text-foreground">{formatMoney(guest.revenue, locale)}</span>
                    <span className="text-body-caption text-muted-foreground">
                      {t("orderCount", { count: guest.orders, formatted: formatNumber(guest.orders, locale) })}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <StatCard
          label={t("guests.events")}
          value={formatNumber(events.held, locale)}
          hint={t("guests.eventsHint", { seats: formatNumber(events.seatsTaken, locale) })}
          icon={PartyPopper}
          tone="info"
          href="/dashboard/events"
        />
      </div>
    </div>
  );
}
