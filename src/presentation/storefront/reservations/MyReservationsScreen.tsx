import { CalendarClock, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { isGuestCancellableReservation, type Reservation } from "@/src/domain/entities/Reservation";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate, formatOrderTime } from "@/src/lib/formatOrderDate";
import { ReservationStatusBadge } from "@/src/presentation/dashboard/reservations/ReservationStatusBadge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { CancelMyReservationButton } from "./CancelMyReservationButton";

type MyReservationsScreenProps = {
  reservations: Reservation[];
  /** "Now", from the page, to split upcoming from past without a client clock. */
  now: string;
};

/** The guest's bookings: upcoming first, with the table once staff confirm, and a way to cancel. */
export async function MyReservationsScreen({ reservations, now }: MyReservationsScreenProps) {
  const t = await getTranslations("site");
  const locale = await getLocale();
  const nowDate = new Date(now);
  const upcoming = reservations.filter((r) => new Date(r.startsAt) > nowDate);
  const past = reservations.filter((r) => new Date(r.startsAt) <= nowDate).reverse();

  function row(reservation: Reservation) {
    return (
      <li key={reservation.id} className="flex flex-wrap items-center gap-3 rounded-card-md border border-border p-4">
        <div className="min-w-0 flex-1">
          <p className="text-body-small-strong text-foreground">
            {formatOrderDate(reservation.startsAt, locale)} · {formatOrderTime(reservation.startsAt, locale)}
          </p>
          <p className="text-body-caption text-muted-foreground">
            {t("book.guests", { count: reservation.partySize, formatted: formatNumber(reservation.partySize, locale) })}
            {reservation.tableLabel ? ` · ${t("reservations.table", { table: reservation.tableLabel })}` : null}
            {` · R-${formatNumber(reservation.reference, locale)}`}
          </p>
        </div>
        <ReservationStatusBadge status={reservation.status} />
        {isGuestCancellableReservation(reservation, nowDate) ? (
          <CancelMyReservationButton reservationId={reservation.id} />
        ) : null}
      </li>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-heading-page text-foreground">{t("reservations.heading")}</h1>
        <Button asChild size="sm">
          <Link href="/book">
            <Icon icon={Plus} size="sm" className="me-1" />
            {t("reservations.new")}
          </Link>
        </Button>
      </div>
      {upcoming.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t("reservations.empty")}
          className="rounded-card-lg border border-dashed border-border py-10"
        />
      ) : (
        <ul className="flex flex-col gap-3">{upcoming.map(row)}</ul>
      )}
      {past.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-body-lead text-foreground">{t("reservations.past")}</h2>
          <ul className="flex flex-col gap-3 opacity-80">{past.slice(0, 10).map(row)}</ul>
        </section>
      ) : null}
    </div>
  );
}
