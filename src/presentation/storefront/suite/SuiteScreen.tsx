import { BedDouble, CalendarCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import {
  isGuestCancellableSuiteBooking,
  suiteNights,
  type SuiteBooking,
  type SuiteBusyRange,
} from "@/src/domain/entities/SuiteBooking";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { SuiteBookingStatusBadge } from "@/src/presentation/dashboard/suite-bookings/SuiteBookingStatusBadge";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

import { BookSuiteForm } from "./BookSuiteForm";
import { CancelMySuiteBookingButton } from "./CancelMySuiteBookingButton";

type SuiteScreenProps = {
  /** The nights already held, so the guest can pick free ones. */
  busy: SuiteBusyRange[];
  /** The guest's own stays. */
  bookings: SuiteBooking[];
  /** Today on the cafe calendar, from the page. */
  today: string;
};

/** The suite: ask for a stay, see which nights are taken, and follow (or cancel) your own stays. */
export async function SuiteScreen({ busy, bookings, today }: SuiteScreenProps) {
  const t = await getTranslations("site");
  const locale = await getLocale();
  const upcoming = bookings.filter((booking) => booking.checkOut > today);
  const past = bookings.filter((booking) => booking.checkOut <= today).reverse();

  function range(stay: SuiteBusyRange): string {
    return `${formatCafeDayMedium(stay.checkIn, locale)} → ${formatCafeDayMedium(stay.checkOut, locale)}`;
  }

  function row(booking: SuiteBooking) {
    const nights = suiteNights(booking.checkIn, booking.checkOut);
    return (
      <li key={booking.id} className="flex flex-wrap items-center gap-3 rounded-card-md border border-border p-4">
        <div className="min-w-0 flex-1">
          <p className="text-body-small-strong text-foreground">{range(booking)}</p>
          <p className="text-body-caption text-muted-foreground">
            {t("suite.nights", { count: nights, formatted: formatNumber(nights, locale) })} ·{" "}
            {t("book.guests", { count: booking.guests, formatted: formatNumber(booking.guests, locale) })}
            {` · S-${formatNumber(booking.reference, locale)}`}
          </p>
        </div>
        <SuiteBookingStatusBadge status={booking.status} />
        {isGuestCancellableSuiteBooking(booking, today) ? <CancelMySuiteBookingButton bookingId={booking.id} /> : null}
      </li>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-heading-page text-foreground">{t("suite.heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("suite.subtitle")}</p>
      </div>

      <BookSuiteForm today={today} />

      <section className="flex flex-col gap-3">
        <h2 className="text-body-lead text-foreground">{t("suite.takenHeading")}</h2>
        {busy.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={t("suite.allFree")}
            className="rounded-card-lg border border-dashed border-border py-8"
          />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {busy.map((stay) => (
              <li
                key={`${stay.checkIn}-${stay.checkOut}`}
                className="rounded-full bg-muted px-3 py-1 text-body-caption text-foreground"
              >
                {range(stay)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-body-lead text-foreground">{t("suite.myHeading")}</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={BedDouble}
            title={t("suite.empty")}
            className="rounded-card-lg border border-dashed border-border py-10"
          />
        ) : (
          <ul className="flex flex-col gap-3">{upcoming.map(row)}</ul>
        )}
      </section>

      {past.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-body-lead text-foreground">{t("suite.past")}</h2>
          <ul className="flex flex-col gap-3 opacity-80">{past.slice(0, 10).map(row)}</ul>
        </section>
      ) : null}
    </div>
  );
}
