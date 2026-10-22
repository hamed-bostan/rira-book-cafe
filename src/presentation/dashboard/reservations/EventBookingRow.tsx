import { Armchair, CalendarDays, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { CafeEvent } from "@/src/domain/entities/CafeEvent";
import { isWholeFloor } from "@/src/domain/entities/CafeTable";
import { Link } from "@/src/i18n/navigation";
import { formatEventTime } from "@/src/lib/formatEventWhen";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { tableNameValues } from "../floor/tableName";

type EventBookingRowProps = {
  event: CafeEvent;
};

/**
 * An event in the day's list, at its time: what it is, which tables it holds (so
 * the floor sees why they can't be booked) and how full it is, with a way to it.
 */
export async function EventBookingRow({ event }: EventBookingRowProps) {
  const t = await getTranslations("dashReservations");
  const tEvents = await getTranslations("dashEvents");
  const tFloor = await getTranslations("floorTables");
  const locale = await getLocale();

  const tables = isWholeFloor(event.tableLabels)
    ? t("eventHoldsWholeFloor")
    : event.tableLabels.length > 0
      ? t("eventHolds", {
          tables: event.tableLabels.map((label) => tFloor("tableName", tableNameValues(label, locale))).join(", "),
        })
      : t("eventHoldsNone");
  const taken = formatNumber(event.seatsTaken, locale);

  return (
    <article
      aria-label={t("eventAria", { title: event.title, time: formatEventTime(event.startsAt, locale) })}
      className="flex flex-wrap items-start gap-x-5 gap-y-3 bg-info px-5 py-4"
    >
      <div className="flex w-24 shrink-0 flex-col whitespace-nowrap tabular-nums">
        <span className="text-body-lead font-semibold text-foreground">{formatEventTime(event.startsAt, locale)}</span>
        <span className="text-body-small text-muted-foreground sm:text-body-caption">
          {t("until", { time: formatEventTime(event.endsAt, locale) })}
        </span>
      </div>

      <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-body-strong text-foreground sm:text-body-small-strong">{event.title}</span>
          <span className="inline-flex h-6 items-center gap-1.5 rounded-badge-md border border-info-border bg-background px-2 text-body-caption-bold whitespace-nowrap text-info-foreground">
            <Icon icon={CalendarDays} size="xs" />
            {t("eventBadge", { kind: tEvents(`kind.${event.kind}`) })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-default text-foreground/80 sm:text-body-small">
          <span className="flex items-center gap-1.5 font-medium">
            <Icon icon={Armchair} size="sm" className="text-info-foreground" />
            {tables}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Icon icon={Users} size="sm" className="text-muted-foreground" />
            {event.capacity === undefined
              ? t("eventSeatsUnlimited", { taken })
              : t("eventSeats", { taken, capacity: formatNumber(event.capacity, locale) })}
          </span>
        </div>
      </div>

      <Link
        href="/dashboard/events"
        className={cn(
          "ms-auto flex h-11 shrink-0 items-center justify-center rounded-button border border-info-border bg-background px-3 text-body-default font-medium whitespace-nowrap text-foreground transition-colors hover:bg-muted sm:h-9 sm:text-body-small",
          focusRing,
        )}
      >
        {t("openEvent")}
      </Link>
    </article>
  );
}
