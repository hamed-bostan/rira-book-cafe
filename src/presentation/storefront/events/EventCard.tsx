import { CalendarDays } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { seatsLeft, type CafeEvent } from "@/src/domain/entities/CafeEvent";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate, formatOrderTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { FadeInImage } from "@/src/presentation/components/FadeInImage";
import { Badge, Icon, focusRing, interactiveCard, zoomOnGroupHover } from "@/src/presentation/design-system";

import { eventTitle } from "../eventCopy";

/** An event teaser: cover, kind, when, price, and how many seats are left. The whole card links to it. */
export async function EventCard({ event }: { event: CafeEvent }) {
  const t = await getTranslations("site");
  const tEvents = await getTranslations("dashEvents");
  const locale = await getLocale();
  const left = seatsLeft(event);

  return (
    <Link
      href={`/events/${event.id}`}
      className={cn("group flex flex-col overflow-hidden rounded-card-lg border border-border bg-background hover:bg-muted", interactiveCard, focusRing)}
    >
      {event.imageUrl ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          <FadeInImage src={event.imageUrl} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className={cn("object-cover", zoomOnGroupHover)} />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">{tEvents(`kind.${event.kind}`)}</Badge>
          {left === 0 ? <Badge variant="warning">{t("events.full")}</Badge> : null}
        </div>
        <p className="text-body-strong text-foreground">{eventTitle(event, locale)}</p>
        <p className="flex items-center gap-1.5 text-body-small text-muted-foreground">
          <Icon icon={CalendarDays} size="xs" />
          {formatOrderDate(event.startsAt, locale)} · {formatOrderTime(event.startsAt, locale)}
        </p>
        <p className="mt-auto text-body-small text-foreground">
          {event.price === 0 ? t("events.free") : formatMoney(event.price, locale)}
          {left !== undefined && left > 0 ? ` · ${t("events.seatsLeft", { count: left, formatted: formatNumber(left, locale) })}` : null}
        </p>
      </div>
    </Link>
  );
}
