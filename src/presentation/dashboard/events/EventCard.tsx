import { CalendarDays } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { seatsLeft, type CafeEvent } from "@/src/domain/entities/CafeEvent";
import { isWholeFloor } from "@/src/domain/entities/CafeTable";
import { Link } from "@/src/i18n/navigation";
import { formatEventWhen } from "@/src/lib/formatEventWhen";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { tableNameValues } from "../floor/tableName";

import { HoldTablesButton } from "./HoldTablesButton";
import { TableFit } from "./TableFit";

type EventCardProps = {
  event: CafeEvent;
  /** On today's cafe day or later: it can be edited. Past cards are dimmed. */
  upcoming: boolean;
  /** Starts on today's cafe day. */
  today: boolean;
  /** Already ended — its tables can't change any more, even on its own day. */
  over: boolean;
  canManage: boolean;
};

/**
 * One event on the dashboard list: kind and status, when, seats taken against
 * capacity with the ticket price, and the tables held for it — with how their
 * seats compare to the guests expected.
 */
export async function EventCard({ event, upcoming, today, over, canManage }: EventCardProps) {
  const t = await getTranslations("dashEvents");
  const tFloor = await getTranslations("floorTables");
  const locale = await getLocale();

  const left = seatsLeft(event);
  const when = formatEventWhen(event.startsAt, event.endsAt, locale);
  const shortWhen = formatEventWhen(event.startsAt, event.endsAt, locale, "short");
  const tableNames = isWholeFloor(event.tableLabels)
    ? [tFloor("wholeFloor")]
    : event.tableLabels.map((label) => tFloor("tableName", tableNameValues(label, locale)));

  return (
    <article
      aria-label={event.title}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-card-lg border border-border bg-background p-5 shadow-xs",
        !upcoming && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge size="compact" className="text-foreground/80">
          {t(`kind.${event.kind}`)}
        </Badge>
        <Badge variant={event.isPublished ? "success" : "neutral"} appearance="outline" size="compact" dot>
          {event.isPublished ? t("published") : t("draft")}
        </Badge>
        {upcoming && today ? (
          <Badge variant="info" appearance="outline" size="compact">
            {t("today")}
          </Badge>
        ) : null}
        {left === 0 ? (
          <Badge size="compact" className="text-foreground/80">
            {t("full")}
          </Badge>
        ) : null}
        {canManage && upcoming ? (
          <Link
            href={`/dashboard/events/${event.id}/edit`}
            aria-label={t("editAria", { title: event.title })}
            // 44px to the touch, pulled into the badge row's height so it doesn't push the card taller.
            className={cn(
              "-my-2.5 ms-auto -me-2 flex min-h-11 items-center rounded-button px-3 text-body-default font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:-my-1.5 sm:min-h-9 sm:text-body-small",
              focusRing,
            )}
          >
            {t("edit")}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-body-lead font-semibold text-pretty text-foreground lg:text-heading-subsection">
          {event.title}
        </h2>
        <p className="flex items-center gap-1.5 text-body-default text-foreground/80 sm:text-body-small">
          <Icon icon={CalendarDays} size="icon-md" className="text-muted-foreground" />
          {when}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-body-default tabular-nums sm:text-body-small">
          <span className="text-foreground/80">
            {event.capacity === undefined
              ? t("seatsTakenUnlimited", { taken: formatNumber(event.seatsTaken, locale) })
              : t.rich("seatsOf", {
                  taken: formatNumber(event.seatsTaken, locale),
                  capacity: formatNumber(event.capacity, locale),
                  strong: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
                })}
          </span>
          <span className="font-medium text-foreground/80">
            {event.price === 0 ? t("free") : formatMoney(event.price, locale)}
          </span>
        </div>
        {event.capacity !== undefined ? (
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full", left === 0 ? "bg-primary-hover" : "bg-primary")}
              style={{ width: `${Math.min(100, (event.seatsTaken / event.capacity) * 100)}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex min-h-11 items-center justify-between gap-3 sm:min-h-9">
          <span className="text-body-caption font-semibold tracking-wider text-muted-foreground uppercase">
            {t("tablesHeld")}
          </span>
          {canManage && upcoming && !over ? (
            <HoldTablesButton
              eventId={event.id}
              title={event.title}
              subtitle={
                event.capacity === undefined
                  ? t("holdSubtitleUnlimited", { when: shortWhen })
                  : t("holdSubtitle", { when: shortWhen, capacity: formatNumber(event.capacity, locale) })
              }
              capacity={event.capacity}
              hasTables={event.tableLabels.length > 0}
            />
          ) : null}
        </div>
        {tableNames.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-1.5">
              {tableNames.map((name) => (
                <li key={name}>
                  <Badge variant="info" appearance="outline" size="compact">
                    {name}
                  </Badge>
                </li>
              ))}
            </ul>
            <TableFit tableLabels={event.tableLabels} capacity={event.capacity} />
          </>
        ) : (
          <p className="text-body-default text-muted-foreground sm:text-body-small">{t("noTablesHeld")}</p>
        )}
      </div>
    </article>
  );
}
