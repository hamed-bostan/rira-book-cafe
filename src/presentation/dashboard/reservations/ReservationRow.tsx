import { Armchair, MessageSquare, Phone, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { FloorBooking, FloorEvent } from "@/src/domain/entities/FloorAvailability";
import { reservationEndsAt, type Reservation } from "@/src/domain/entities/Reservation";
import { formatEventTime } from "@/src/lib/formatEventWhen";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { tableNameValues } from "../floor/tableName";

import { ReservationRowActions } from "./ReservationRowActions";
import { ReservationStatusBadge } from "./ReservationStatusBadge";

/** A confirmed party this many minutes past its time is flagged late. */
const LATE_AFTER_MINUTES = 15;

type ReservationRowProps = {
  reservation: Reservation;
  /** "Now", from the page — whether a confirmed party is running late. */
  now: string;
  canManage: boolean;
  /** The day's bookings and events, for the table picker. */
  bookings: readonly FloorBooking[];
  events: readonly FloorEvent[];
};

/**
 * One booking on the day view: when (and until when), the guest with the
 * booking's status — and how late, for a party that hasn't arrived — the party,
 * the table (or that it still needs one), the phone, any note, and the controls.
 */
export async function ReservationRow({ reservation, now, canManage, bookings, events }: ReservationRowProps) {
  const t = await getTranslations("dashReservations");
  const tFloor = await getTranslations("floorTables");
  const locale = await getLocale();

  const lateBy = Math.floor((new Date(now).getTime() - new Date(reservation.startsAt).getTime()) / 60_000);
  const late = reservation.status === "confirmed" && lateBy >= LATE_AFTER_MINUTES;
  const finished = ["completed", "cancelled", "noShow"].includes(reservation.status);
  const time = formatEventTime(reservation.startsAt, locale);

  return (
    <article
      aria-label={`R-${reservation.reference}, ${reservation.guestName}, ${time}`}
      className={cn("flex flex-wrap items-start gap-x-5 gap-y-3 px-5 py-4", finished && "opacity-70")}
    >
      <div className="flex w-24 shrink-0 flex-col whitespace-nowrap tabular-nums">
        <span className="text-body-lead font-semibold text-foreground">{time}</span>
        <span className="text-body-small text-muted-foreground sm:text-body-caption">
          {t("until", { time: formatEventTime(reservationEndsAt(reservation).toISOString(), locale) })}
        </span>
        <span className="text-body-small font-medium text-muted-foreground sm:text-body-caption">
          R-{reservation.reference}
        </span>
      </div>

      <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-body-strong text-foreground sm:text-body-small-strong">{reservation.guestName}</span>
          <ReservationStatusBadge status={reservation.status} outlined />
          {late ? (
            <span className="text-body-small font-semibold whitespace-nowrap text-error-foreground sm:text-body-caption">
              {t("latePast", { minutes: formatNumber(lateBy, locale) })}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-default text-foreground/80 sm:text-body-small">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Icon icon={Users} size="sm" className="text-muted-foreground" />
            {t("partySize", { count: reservation.partySize, formatted: formatNumber(reservation.partySize, locale) })}
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap",
              !reservation.tableLabel && "font-medium text-warning-foreground",
            )}
          >
            <Icon icon={Armchair} size="sm" />
            {reservation.tableLabel
              ? tFloor("tableName", tableNameValues(reservation.tableLabel, locale))
              : t("noTable")}
          </span>
          <a
            href={`tel:${reservation.guestPhone.replace(/\s/g, "")}`}
            dir="ltr"
            // 44px to the touch on a phone without moving the row.
            className={cn(
              "-my-3 flex items-center gap-1.5 py-3 whitespace-nowrap tabular-nums transition-colors hover:text-primary sm:my-0 sm:py-0",
              focusRing,
            )}
          >
            <Icon icon={Phone} size="sm" className="text-muted-foreground" />
            {reservation.guestPhone}
          </a>
        </div>
        {reservation.note ? (
          <p className="flex items-start gap-1.5 text-body-default text-pretty text-muted-foreground sm:text-body-small">
            <Icon icon={MessageSquare} size="sm" className="mt-0.5 shrink-0" />“{reservation.note}”
          </p>
        ) : null}
      </div>

      {canManage ? <ReservationRowActions reservation={reservation} bookings={bookings} events={events} /> : null}
    </article>
  );
}
