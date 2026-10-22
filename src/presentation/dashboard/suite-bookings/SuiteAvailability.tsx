import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { suiteNights, type SuiteBooking, type SuiteBookingStatus } from "@/src/domain/entities/SuiteBooking";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayHeader, formatCafeDayMedium, formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { WINDOW_DAYS, WINDOW_LEAD_DAYS, WINDOW_STEP_DAYS } from "./suiteCalendar";

/** The cafe's weekend day (Friday), shaded on the strip. */
const WEEKEND_DAY = 5;
/** Grid column of the first day (the first column holds the row labels). */
const FIRST_DAY_COLUMN = 2;

/** Bar colours by status: the same tones as the status badges. */
const TONE: Partial<Record<SuiteBookingStatus, string>> = {
  checkedIn: "border-success-border bg-success text-success-foreground hover:border-success-foreground",
  confirmed: "border-info-border bg-info text-info-foreground hover:border-info-foreground",
  requested: "border-warning-border bg-warning text-warning-foreground hover:border-warning-foreground",
  checkedOut: "border-border bg-muted text-muted-foreground hover:border-muted-foreground",
};
const FOCUSED: Partial<Record<SuiteBookingStatus, string>> = {
  checkedIn: "border-success-foreground",
  confirmed: "border-info-foreground",
  requested: "border-warning-foreground",
  checkedOut: "border-muted-foreground",
};
const LEGEND: readonly { status: SuiteBookingStatus; swatch: string }[] = [
  { status: "checkedIn", swatch: "border-success-foreground bg-success" },
  { status: "confirmed", swatch: "border-info-foreground bg-info" },
  { status: "requested", swatch: "border-warning-foreground bg-warning" },
  { status: "checkedOut", swatch: "border-muted-foreground bg-muted" },
];

type SuiteAvailabilityProps = {
  bookings: readonly SuiteBooking[];
  /** First day on the strip, `YYYY-MM-DD`. */
  windowStart: string;
  today: string;
  /** The stay picked from the strip, outlined. */
  focusId: string | undefined;
  /** Where a bar leads — the stay's row in its tab. */
  hrefForStay: (booking: SuiteBooking) => string;
  /** Where the strip's arrows lead — the same page starting another day. */
  hrefForWindow: (start: string) => string;
};

/**
 * The suite's next three weeks at a glance: held stays on one row, requests on
 * the other, so a request that overlaps a held stay is plain to see. Today is
 * tinted and Fridays shaded. Steps a week back or forward; a bar opens its stay.
 */
export async function SuiteAvailability({
  bookings,
  windowStart,
  today,
  focusId,
  hrefForStay,
  hrefForWindow,
}: SuiteAvailabilityProps) {
  const t = await getTranslations("dashSuite");
  const locale = await getLocale();

  const windowEnd = shiftCafeDay(windowStart, WINDOW_DAYS);
  const home = shiftCafeDay(today, -WINDOW_LEAD_DAYS);
  const days = Array.from({ length: WINDOW_DAYS }, (_, index) => shiftCafeDay(windowStart, index));
  const bars = bookings.filter(
    (booking) => TONE[booking.status] !== undefined && booking.checkIn < windowEnd && booking.checkOut > windowStart,
  );
  const segment = cn(
    "flex h-11 items-center justify-center text-foreground/80 transition-colors hover:bg-muted sm:h-9",
    focusRing,
  );

  return (
    <section
      aria-labelledby="suite-availability"
      className="flex min-w-0 flex-col gap-4 rounded-card-lg border border-border bg-background p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="suite-availability" className="text-body-strong text-foreground">
            {t("availability")}
          </h2>
          <p className="text-body-small text-muted-foreground sm:text-body-caption">
            {formatCafeDayShort(windowStart, locale)} – {formatCafeDayMedium(shiftCafeDay(windowEnd, -1), locale)}
          </p>
        </div>
        <nav
          aria-label={t("availabilityNav")}
          className="flex items-center rounded-button border border-border bg-background"
        >
          <Link
            href={hrefForWindow(shiftCafeDay(windowStart, -WINDOW_STEP_DAYS))}
            aria-label={t("earlier")}
            className={cn(segment, "w-11 rounded-s-button sm:w-9")}
          >
            <Icon icon={ChevronLeft} size="sm" className="rtl:-scale-x-100" />
          </Link>
          <Link
            href={hrefForWindow(home)}
            aria-current={windowStart === home ? "date" : undefined}
            className={cn(
              segment,
              "border-x border-border px-3 text-body-default font-medium sm:text-body-small",
              windowStart === home && "text-muted-foreground",
            )}
          >
            {t("today")}
          </Link>
          <Link
            href={hrefForWindow(shiftCafeDay(windowStart, WINDOW_STEP_DAYS))}
            aria-label={t("later")}
            className={cn(segment, "w-11 rounded-e-button sm:w-9")}
          >
            <Icon icon={ChevronRight} size="sm" className="rtl:-scale-x-100" />
          </Link>
        </nav>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-[6rem_repeat(21,minmax(2.5rem,1fr))] grid-rows-[auto_3rem_3rem]">
          {days.map((day, index) => {
            const head = formatCafeDayHeader(day, locale);
            const isToday = day === today;
            return (
              <div
                key={`head-${day}`}
                style={{ gridRow: 1, gridColumn: index + FIRST_DAY_COLUMN }}
                className={cn("flex flex-col items-center rounded-t-button pt-1 pb-2", isToday && "bg-accent")}
              >
                <span className={cn("text-body-caption", isToday ? "text-accent-foreground" : "text-muted-foreground")}>
                  {head.weekday}
                </span>
                <span
                  className={cn(
                    "text-body-small font-semibold tabular-nums sm:text-body-caption-bold",
                    isToday ? "text-accent-foreground" : "text-foreground",
                  )}
                >
                  {head.day}
                </span>
              </div>
            );
          })}
          <span
            style={{ gridRow: 2, gridColumn: 1 }}
            className="self-center text-body-small font-medium text-foreground/80 sm:text-body-caption"
          >
            {t("rowHeld")}
          </span>
          <span
            style={{ gridRow: 3, gridColumn: 1 }}
            className="self-center text-body-small font-medium text-foreground/80 sm:text-body-caption"
          >
            {t("rowRequests")}
          </span>
          {days.map((day, index) => (
            <div
              key={`col-${day}`}
              aria-hidden
              style={{ gridRow: "2 / span 2", gridColumn: index + FIRST_DAY_COLUMN }}
              className={cn(
                "border-s border-t border-border",
                day === today ? "bg-accent" : new Date(`${day}T12:00:00Z`).getUTCDay() === WEEKEND_DAY && "bg-canvas",
              )}
            />
          ))}
          {bars.map((booking) => {
            const start = booking.checkIn > windowStart ? booking.checkIn : windowStart;
            const end = booking.checkOut < windowEnd ? booking.checkOut : windowEnd;
            const title = t("barTitle", {
              reference: booking.reference,
              name: booking.guestName,
              from: formatCafeDayShort(booking.checkIn, locale),
              to: formatCafeDayShort(booking.checkOut, locale),
              status: t(`status.${booking.status}`),
            });
            return (
              <Link
                key={booking.id}
                href={hrefForStay(booking)}
                title={title}
                aria-label={title}
                style={{
                  gridRow: booking.status === "requested" ? 3 : 2,
                  gridColumn: `${suiteNights(windowStart, start) + FIRST_DAY_COLUMN} / span ${suiteNights(start, end)}`,
                }}
                className={cn(
                  "z-10 mx-0.5 flex h-8 min-w-0 items-center self-center overflow-hidden rounded-button border px-2 text-body-caption-bold whitespace-nowrap transition-colors",
                  TONE[booking.status],
                  booking.id === focusId && FOCUSED[booking.status],
                  focusRing,
                )}
              >
                <span className="truncate">
                  S-{booking.reference} · {booking.guestName}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <ul aria-label={t("legend")} className="flex flex-wrap gap-x-4 gap-y-2">
        {LEGEND.map(({ status, swatch }) => (
          <li
            key={status}
            className="flex items-center gap-1.5 text-body-small text-foreground/80 sm:text-body-caption"
          >
            <span aria-hidden className={cn("h-2 w-4 shrink-0 rounded-button border", swatch)} />
            {t(`status.${status}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
