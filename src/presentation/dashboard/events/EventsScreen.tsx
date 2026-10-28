import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { type CafeEvent } from "@/src/domain/entities/CafeEvent";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardEmptyState } from "../DashboardEmptyState";

import { EventCard } from "./EventCard";
import { EventTabs, type EventTab } from "./EventTabs";

type EventsScreenProps = {
  /** Every event, newest start first. */
  events: CafeEvent[];
  tab: EventTab;
  /** Whether the viewer may create and edit events and hold their tables. */
  canManage: boolean;
  /** "Now", from the page — splits upcoming from past without a client clock. */
  now: string;
};

/**
 * Dashboard events list: Upcoming (soonest first) and Past (latest first) tabs of
 * event cards, each with its seats and the tables held for it. The split is by
 * cafe day, as the design draws it — today's events stay under Upcoming all day.
 */
export async function EventsScreen({ events, tab, canManage, now }: EventsScreenProps) {
  const t = await getTranslations("dashEvents");
  const nowDate = new Date(now);
  const todayDay = cafeDayOf(nowDate);
  const dayOf = (event: CafeEvent): string => cafeDayOf(new Date(event.startsAt));

  const upcoming = events.filter((event) => dayOf(event) >= todayDay).reverse();
  const past = events.filter((event) => dayOf(event) < todayDay);
  const shown = tab === "upcoming" ? upcoming : past;
  const drafts = upcoming.filter((event) => !event.isPublished).length;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-muted-foreground sm:text-body-small">
            {t("summary", { count: upcoming.length })}
            {drafts > 0 ? ` · ${t("summaryDrafts", { count: drafts })}` : null}
          </p>
        </div>
        {canManage ? (
          <Button size="control-md" asChild className="gap-2 px-4">
            <Link href="/dashboard/events/create">
              <Icon icon={Plus} size="icon-md" />
              {t("newEvent")}
            </Link>
          </Button>
        ) : null}
      </div>

      <EventTabs current={tab} counts={{ upcoming: upcoming.length, past: past.length }} />

      {shown.length === 0 ? (
        <DashboardEmptyState
          title={tab === "upcoming" ? t("emptyUpcomingTitle") : t("emptyPastTitle")}
          body={tab === "upcoming" ? t("emptyUpcomingBody") : t("emptyPastBody")}
        />
      ) : (
        <ul className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {shown.map((event) => (
            <li key={event.id} className="min-w-0">
              <EventCard
                event={event}
                upcoming={tab === "upcoming"}
                today={dayOf(event) === todayDay}
                over={new Date(event.endsAt) <= nowDate}
                canManage={canManage}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
