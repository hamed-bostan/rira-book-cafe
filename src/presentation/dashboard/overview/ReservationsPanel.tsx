import { Check } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { Reservation, ReservationStatus } from "@/src/domain/entities/Reservation";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { DashboardEmptyState } from "@/src/presentation/dashboard/DashboardEmptyState";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { ConfirmReservationButton } from "./ConfirmReservationButton";
import { OverviewPanel, OverviewPanelRow } from "./OverviewPanel";

/** The bookings still ahead of the floor today; finished, cancelled and no-show ones drop off. */
const SHOWN_STATUSES: readonly ReservationStatus[] = ["requested", "confirmed", "seated"];

type ReservationsPanelProps = {
  /** Today's reservations, in start order. */
  reservations: Reservation[];
  /** Draws the Confirm button on requested bookings (`reservations.manage`). */
  canManage: boolean;
};

/**
 * Today's bookings in time order: when, where, who and how many — with a one-tap
 * Confirm on the ones still waiting for an answer. A table can be assigned later
 * from the reservations page; confirming doesn't need one.
 */
export async function ReservationsPanel({ reservations, canManage }: ReservationsPanelProps) {
  const t = await getTranslations("dashOverview");
  const tRes = await getTranslations("dashReservations");
  const locale = await getLocale();
  const shown = reservations.filter((reservation) => SHOWN_STATUSES.includes(reservation.status));

  return (
    <OverviewPanel
      id="overview-reservations"
      title={t("reservationsHeading")}
      count={formatNumber(shown.length, locale)}
      action={{ href: "/dashboard/reservations", label: t("viewAll") }}
    >
      {shown.length === 0 ? (
        <DashboardEmptyState
          title={t("reservationsEmptyTitle")}
          body={t("reservationsEmptyBody")}
          className="border-t border-border py-10"
        />
      ) : (
        shown.map((reservation) => {
          const requested = reservation.status === "requested";
          return (
            <OverviewPanelRow key={reservation.id}>
              <span className="flex w-20 shrink-0 flex-col whitespace-nowrap tabular-nums">
                <span className="text-body-strong text-foreground sm:text-body-small-strong">
                  {formatOrderTime(reservation.startsAt, locale)}
                </span>
                <span className="truncate text-body-small text-muted-foreground sm:text-body-caption">
                  {reservation.tableLabel ? tRes("table", { table: reservation.tableLabel }) : tRes("noTable")}
                </span>
              </span>

              <span className="flex min-w-0 flex-[1_1_9rem] flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span dir="auto" className="text-body-emphasis text-foreground sm:text-body-small-emphasis">
                    {reservation.guestName}
                  </span>
                  {requested ? (
                    <Badge variant="warning" appearance="outline" dot size="compact">
                      {t("unconfirmed")}
                    </Badge>
                  ) : null}
                </span>
                <span className="text-body-small text-muted-foreground sm:text-body-caption">
                  {tRes("partySize", {
                    count: reservation.partySize,
                    formatted: formatNumber(reservation.partySize, locale),
                  })}
                </span>
              </span>

              {requested ? (
                canManage ? (
                  <ConfirmReservationButton
                    reservationId={reservation.id}
                    reference={reservation.reference}
                    guestName={reservation.guestName}
                  />
                ) : null
              ) : (
                <span className="ms-auto flex shrink-0 items-center gap-1.5 text-body-default whitespace-nowrap text-muted-foreground sm:text-body-small">
                  <Icon icon={Check} size="icon-md" />
                  {tRes(`status.${reservation.status}`)}
                </span>
              )}
            </OverviewPanelRow>
          );
        })
      )}
    </OverviewPanel>
  );
}
