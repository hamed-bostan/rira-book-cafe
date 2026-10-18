import { CalendarClock, SearchX } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { cafeDayRange } from "@/src/domain/entities/CafeTime";
import { RESERVATION_STATUSES, type Reservation } from "@/src/domain/entities/Reservation";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { ListFilterSelect } from "@/src/presentation/dashboard/list";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

import { ReservationCard } from "./ReservationCard";
import { ReservationDayPicker } from "./ReservationDayPicker";

const REFRESH_SECONDS = 30;

type ReservationsScreenProps = {
  reservations: Reservation[];
  /** The day on screen and today, `YYYY-MM-DD` on the cafe calendar. */
  day: string;
  today: string;
  /** Whether a status filter is applied — to tell "no bookings" from "no matches". */
  isFiltered: boolean;
  /** The query string, so the day picker keeps the status filter. */
  query: string;
  canManage: boolean;
};

/**
 * The floor's reservation book for one day. Presentational: the page fetches the
 * day over the REST API (BFF). The day and status filter live in the URL; the
 * list re-reads itself while open, and every action `router.refresh()`es.
 */
export async function ReservationsScreen({
  reservations,
  day,
  today,
  isFiltered,
  query,
  canManage,
}: ReservationsScreenProps) {
  const t = await getTranslations("dashReservations");
  const locale = await getLocale();

  const active = reservations.filter((r) => r.status !== "cancelled" && r.status !== "noShow");
  const covers = active.reduce((sum, r) => sum + r.partySize, 0);

  return (
    <div className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <AutoRefresh intervalSeconds={REFRESH_SECONDS} />

      <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-small text-muted-foreground">
            {formatOrderDate(cafeDayRange(day).from.toISOString(), locale)} ·{" "}
            {t("summary", {
              bookings: active.length,
              covers,
              bookingsFormatted: formatNumber(active.length, locale),
              coversFormatted: formatNumber(covers, locale),
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ReservationDayPicker day={day} today={today} query={query} />
          <div className="min-w-48">
            <ListFilterSelect
              className="h-9 w-full"
              paramName="status"
              label={t("filterStatusLabel")}
              options={[
                { value: "", label: t("filterStatusOption", { status: t("filterStatusAll") }) },
                ...RESERVATION_STATUSES.map((status) => ({
                  value: status,
                  label: t("filterStatusOption", { status: t(`status.${status}`) }),
                })),
              ]}
            />
          </div>
        </div>
      </div>

      {reservations.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {reservations.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} canManage={canManage} />
          ))}
        </ul>
      ) : (
        <div className="rounded-card-lg border border-dashed border-border">
          <EmptyState
            icon={isFiltered ? SearchX : CalendarClock}
            title={isFiltered ? t("noMatchesTitle") : t("emptyTitle")}
            description={isFiltered ? t("noMatchesBody") : t("emptyBody")}
          />
        </div>
      )}
    </div>
  );
}
