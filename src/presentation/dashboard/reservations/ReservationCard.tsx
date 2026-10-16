import { StickyNote, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { Reservation } from "@/src/domain/entities/Reservation";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { Icon } from "@/src/presentation/design-system";

import { ReservationActions } from "./ReservationActions";
import { ReservationStatusBadge } from "./ReservationStatusBadge";

type ReservationCardProps = {
  reservation: Reservation;
  /** Whether to draw the workflow controls. */
  canManage: boolean;
};

/** One booking on the day view: time, guest, party, table, note, status and controls. */
export async function ReservationCard({ reservation, canManage }: ReservationCardProps) {
  const t = await getTranslations("dashReservations");
  const locale = await getLocale();

  return (
    <li className="flex flex-col gap-3 rounded-card-md border border-border bg-background p-4 @min-[40rem]:flex-row @min-[40rem]:items-start">
      <div className="w-20 shrink-0">
        <p className="text-body-strong tabular-nums text-foreground">{formatOrderTime(reservation.startsAt, locale)}</p>
        <p className="text-body-caption text-muted-foreground">R-{reservation.reference}</p>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-small-strong text-foreground">{reservation.guestName}</span>
          <ReservationStatusBadge status={reservation.status} />
        </div>
        <p dir="ltr" className="text-start text-body-small text-muted-foreground">{reservation.guestPhone}</p>
        <p className="flex flex-wrap items-center gap-3 text-body-small text-foreground">
          <span className="flex items-center gap-1.5">
            <Icon icon={Users} size="xs" className="text-muted-foreground" />
            {t("partySize", { count: reservation.partySize, formatted: formatNumber(reservation.partySize, locale) })}
          </span>
          <span>{reservation.tableLabel ? t("table", { table: reservation.tableLabel }) : t("noTable")}</span>
        </p>
        {reservation.note ? (
          <p className="flex items-start gap-1.5 text-body-small text-warning-foreground">
            <Icon icon={StickyNote} size="xs" className="mt-0.5 shrink-0" />
            {reservation.note}
          </p>
        ) : null}
      </div>

      {canManage ? (
        <div className="shrink-0">
          <ReservationActions reservation={reservation} />
        </div>
      ) : null}
    </li>
  );
}
