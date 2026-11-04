import { getLocale, getTranslations } from "next-intl/server";

import type { CafeEvent } from "@/src/domain/entities/CafeEvent";
import type { Floor } from "@/src/domain/entities/FloorAvailability";
import type { Reservation } from "@/src/domain/entities/Reservation";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayFull } from "@/src/lib/formatCafeDay";
import { formatEventTime } from "@/src/lib/formatEventWhen";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardLinkTabs } from "../DashboardLinkTabs";

import { EventBookingRow } from "./EventBookingRow";
import { NewBookingDialog } from "./NewBookingDialog";
import { OtherDayRequests } from "./OtherDayRequests";
import { ReservationDayPicker } from "./ReservationDayPicker";
import { ReservationRow } from "./ReservationRow";
import { RESERVATION_TABS, reservationTab, type ReservationTab } from "./reservationTabs";

const REFRESH_SECONDS = 30;

type ReservationsScreenProps = {
  /** Every booking of the day, any status — the tabs count them all. */
  reservations: Reservation[];
  /** Requests from today on that are for some other day, so they aren't missed. */
  otherDayRequests: Reservation[];
  /** What holds the tables around the day — the table pickers grey out what's taken. */
  floor: Floor;
  /** Events running that day, shown at their time with the tables they hold. */
  events: CafeEvent[];
  /** The day on screen and today, `YYYY-MM-DD` on the cafe calendar. */
  day: string;
  today: string;
  /** The status tab, or `undefined` for All. */
  status: ReservationTab | undefined;
  /** "Now", from the page — the Now line and late parties, without a client clock. */
  now: string;
  canManage: boolean;
  /** Whether "Open event" can open the event itself (`events.manage`), not just its card on the list. */
  canManageEvents: boolean;
  /** Whether a held deposit can be kept as income (`accounting.write`), not only handed back. */
  canKeepDeposits?: boolean;
};

type Row =
  | { kind: "booking"; startsAt: string; reservation: Reservation }
  | { kind: "event"; startsAt: string; event: CafeEvent };

/**
 * The floor's book for one day: every booking in time order with the day's events
 * between them, status tabs to narrow it, and — on today — a line where "now"
 * falls; over it, the requests still waiting on other days. Presentational: the
 * page fetches over the REST API (BFF); the day and tab live in the URL, the list
 * re-reads itself while open, and every action `router.refresh()`es.
 */
export async function ReservationsScreen({
  reservations,
  otherDayRequests,
  floor,
  events,
  day,
  today,
  status,
  now,
  canManage,
  canManageEvents,
  canKeepDeposits = false,
}: ReservationsScreenProps) {
  const t = await getTranslations("dashReservations");
  const locale = await getLocale();

  const active = reservations.filter((r) => r.status !== "cancelled" && r.status !== "noShow");
  const covers = active.reduce((sum, r) => sum + r.partySize, 0);
  const requests = reservations.filter((r) => r.status === "requested").length;
  const dayLabel = formatCafeDayFull(day, locale);
  const hrefFor = (tab: ReservationTab | undefined): string => {
    const params = new URLSearchParams();
    if (day !== today) params.set("day", day);
    if (tab) params.set("status", tab);
    const query = params.toString();
    return query ? `/dashboard/reservations?${query}` : "/dashboard/reservations";
  };

  const rows: Row[] = [
    ...reservations
      .filter((r) => !status || reservationTab(r) === status)
      .map((reservation): Row => ({ kind: "booking", startsAt: reservation.startsAt, reservation })),
    // Events sit between bookings on the All tab only — they have no status.
    ...(status ? [] : events.map((event): Row => ({ kind: "event", startsAt: event.startsAt, event }))),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  // On today's All tab, a line marks where now falls among the rows.
  const nowAt = day === today && !status ? rows.findIndex((row) => row.startsAt >= now) : -1;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AutoRefresh intervalSeconds={REFRESH_SECONDS} />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-body-default text-muted-foreground sm:text-body-small">
            <span className="font-medium text-foreground/80">{dayLabel}</span>
            <span aria-hidden>·</span>
            <span>
              {t("summary", {
                bookings: reservations.length,
                covers,
                bookingsFormatted: formatNumber(reservations.length, locale),
                coversFormatted: formatNumber(covers, locale),
              })}
              {events.length > 0 ? ` · ${t("eventsCount", { count: events.length })}` : null}
            </span>
            {requests > 0 && status !== "requested" ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={hrefFor("requested")}
                  // 44px to the touch on a phone without moving the line.
                  className={cn(
                    "-my-3 py-3 font-semibold text-warning-foreground underline underline-offset-4 sm:my-0 sm:py-0",
                    focusRing,
                  )}
                >
                  {t("needReply", { count: requests })}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {canManage && day >= today ? <NewBookingDialog day={day} dayLabel={dayLabel} now={now} floor={floor} /> : null}
      </div>

      <OtherDayRequests requests={otherDayRequests} today={today} />

      <ReservationDayPicker day={day} today={today} />

      <section
        aria-label={t("bookingsLabel")}
        className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
      >
        <DashboardLinkTabs
          className="px-4"
          label={t("filterStatusLabel")}
          current={status ?? "all"}
          tabs={[
            { key: "all", label: t("filterStatusAll"), count: reservations.length, href: hrefFor(undefined) },
            ...RESERVATION_TABS.map((value) => ({
              key: value,
              label: t(`status.${value}`),
              count: reservations.filter((r) => reservationTab(r) === value).length,
              href: hrefFor(value),
            })),
          ]}
        />

        {rows.length > 0 ? (
          <ul>
            {rows.map((row, index) => (
              <li
                key={row.kind === "booking" ? row.reservation.id : `event-${row.event.id}`}
                className={cn(index > 0 && "border-t border-border")}
              >
                {index === nowAt ? (
                  <div
                    aria-hidden
                    className="flex items-center gap-2 px-5 pt-2 text-body-caption-bold tracking-wider text-primary uppercase"
                  >
                    <span className="size-2 rounded-full bg-primary" />
                    {t("nowLine", { time: formatEventTime(now, locale) })}
                    <span className="h-px flex-1 bg-accent-border" />
                  </div>
                ) : null}
                {row.kind === "booking" ? (
                  <ReservationRow
                    reservation={row.reservation}
                    now={now}
                    canManage={canManage}
                    day={day}
                    today={today}
                    floor={floor}
                    canKeepDeposit={canKeepDeposits}
                  />
                ) : (
                  <EventBookingRow
                    event={row.event}
                    today={today}
                    canManageEvents={canManageEvents}
                    tables={floor.tables}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <DashboardEmptyState
            title={status ? t("noMatchesTitle") : t("emptyTitle")}
            body={status ? t("noMatchesBody") : t("emptyBody")}
            action={
              status ? (
                <Button asChild variant="secondary" size="control-md" className="px-4">
                  <Link href={hrefFor(undefined)}>{t("showAll")}</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}
