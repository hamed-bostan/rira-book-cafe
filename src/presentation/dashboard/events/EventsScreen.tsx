import { CalendarDays, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { seatsLeft, type CafeEvent } from "@/src/domain/entities/CafeEvent";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate, formatOrderTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

type EventsScreenProps = {
  events: CafeEvent[];
  /** Whether the viewer may create and edit events. */
  canManage: boolean;
  /** "Now", from the page — splits upcoming from past without a client clock. */
  now: string;
};

/**
 * Dashboard events list: upcoming first (soonest at the top), then past. Each
 * card shows when, what kind, seats taken, price and whether it's published.
 */
export async function EventsScreen({ events, canManage, now }: EventsScreenProps) {
  const t = await getTranslations("dashEvents");
  const locale = await getLocale();
  const nowDate = new Date(now);

  const upcoming = events.filter((event) => new Date(event.endsAt) > nowDate).reverse();
  const past = events.filter((event) => new Date(event.endsAt) <= nowDate);

  function card(event: CafeEvent) {
    const left = seatsLeft(event);
    const content = (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">{t(`kind.${event.kind}`)}</Badge>
          <Badge variant={event.isPublished ? "success" : "neutral"}>
            {event.isPublished ? t("published") : t("draft")}
          </Badge>
          {left === 0 ? <Badge variant="warning">{t("full")}</Badge> : null}
        </div>
        <p className="text-body-strong text-foreground">{event.title}</p>
        <p className="flex items-center gap-1.5 text-body-small text-muted-foreground">
          <Icon icon={CalendarDays} size="xs" />
          {formatOrderDate(event.startsAt, locale)} · {formatOrderTime(event.startsAt, locale)}
        </p>
        <p className="text-body-small text-foreground">
          {left === undefined
            ? t("seatsTakenUnlimited", { taken: formatNumber(event.seatsTaken, locale) })
            : t("seatsTaken", {
                taken: formatNumber(event.seatsTaken, locale),
                capacity: formatNumber(event.capacity ?? 0, locale),
              })}
          {" · "}
          {event.price === 0 ? t("free") : formatMoney(event.price, locale)}
        </p>
      </>
    );

    return (
      <li key={event.id}>
        <Link
          href={`/dashboard/events/${event.id}/edit`}
          className={cn(
            "flex flex-col gap-2 rounded-card-md border border-border bg-background p-4 transition-colors hover:bg-muted",
            focusRing,
          )}
        >
          {content}
        </Link>
      </li>
    );
  }

  const createAction = canManage ? (
    <Button asChild size="sm">
      <Link href="/dashboard/events/create">
        <Icon icon={Plus} size="sm" className="me-1.5" />
        {t("newEvent")}
      </Link>
    </Button>
  ) : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-small text-muted-foreground">{t("summary", { count: upcoming.length })}</p>
        </div>
        {canManage ? (
          <Button asChild className="min-h-11">
            <Link href="/dashboard/events/create">
              <Icon icon={Plus} size="sm" className="me-1.5" />
              {t("newEvent")}
            </Link>
          </Button>
        ) : null}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={createAction}
          className="rounded-card-lg border border-dashed border-border"
        />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-body-lead text-foreground">{t("upcomingHeading")}</h2>
            {upcoming.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{upcoming.map(card)}</ul>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title={t("noUpcoming")}
                action={createAction}
                className="rounded-card-lg border border-dashed border-border py-10"
              />
            )}
          </section>
          {past.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-body-lead text-foreground">{t("pastHeading")}</h2>
              <ul className="grid grid-cols-1 gap-3 opacity-80 md:grid-cols-2">{past.map(card)}</ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
