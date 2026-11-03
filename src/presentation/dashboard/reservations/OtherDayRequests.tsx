import { getLocale, getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { Reservation } from "@/src/domain/entities/Reservation";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayShort, formatCafeDayWeekdayName } from "@/src/lib/formatCafeDay";
import { formatEventTime } from "@/src/lib/formatEventWhen";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { DashboardTabRow } from "../DashboardTabRow";

type OtherDayRequestsProps = {
  /** Requests still waiting for a reply on days other than the one on screen, in start order. */
  requests: readonly Reservation[];
  /** Today on the cafe calendar: its requests read "Today" and link to the page's default day. */
  today: string;
};

/**
 * The requests waiting for a reply on other days, as one compact row over the
 * day's list — day and time, guest and party, each a link to its day — so a table
 * asked for next week is seen now rather than when someone happens to open that
 * day. The row scrolls sideways where it runs past the card (`DashboardTabRow`);
 * with no such requests, nothing shows.
 */
export async function OtherDayRequests({ requests, today }: OtherDayRequestsProps) {
  if (requests.length === 0) return null;
  const t = await getTranslations("dashReservations");
  const locale = await getLocale();
  const heading = t("otherDaysHeading");

  return (
    <section
      aria-labelledby="other-day-requests"
      className="min-w-0 rounded-card-lg border border-warning-border bg-warning shadow-xs"
    >
      <h2
        id="other-day-requests"
        className="flex items-center gap-2 px-5 pt-3 text-body-strong text-warning-foreground sm:text-body-small-strong"
      >
        {heading}
        <span className="inline-flex h-5 min-w-6 items-center justify-center rounded-badge-md bg-background px-1.5 text-body-caption-bold tabular-nums">
          {formatNumber(requests.length, locale)}
        </span>
      </h2>
      <DashboardTabRow label={heading} current="" className="flex gap-2 px-5 pt-2 pb-3">
        {requests.map((reservation) => {
          const day = cafeDayOf(new Date(reservation.startsAt));
          const time = formatEventTime(reservation.startsAt, locale);
          return (
            <Link
              key={reservation.id}
              href={day === today ? "/dashboard/reservations" : `/dashboard/reservations?day=${day}`}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-button border border-warning-border bg-background px-3 text-body-default whitespace-nowrap text-foreground transition-colors hover:bg-muted sm:min-h-9 sm:text-body-small",
                focusRing,
              )}
            >
              <span className="font-semibold tabular-nums">
                {day === today
                  ? t("otherDayToday", { time })
                  : t("otherDayWhen", {
                      weekday: formatCafeDayWeekdayName(day, locale),
                      day: formatCafeDayShort(day, locale),
                      time,
                    })}
              </span>
              {/* A name as long as the form takes (80 characters) ends in an ellipsis, keeping the chip to a phone's width. */}
              <span dir="auto" className="max-w-40 truncate sm:max-w-56">
                {reservation.guestName}
              </span>
              <span className="text-muted-foreground">
                {t("partySize", {
                  count: reservation.partySize,
                  formatted: formatNumber(reservation.partySize, locale),
                })}
              </span>
            </Link>
          );
        })}
      </DashboardTabRow>
    </section>
  );
}
