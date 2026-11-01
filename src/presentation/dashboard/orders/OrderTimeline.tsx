import { getLocale, getTranslations } from "next-intl/server";

import type { OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { DashboardTimelineItem } from "@/src/presentation/dashboard/DashboardTimelineItem";
import { FIELD_HINT } from "@/src/presentation/dashboard/fieldStyles";

/** The order's status history, oldest first: when it came in, and who moved it at each step. */
export async function OrderTimeline({ events }: { events: OrderStatusEvent[] }) {
  const t = await getTranslations("dashOrders");
  const locale = await getLocale();

  if (events.length === 0) return <p className="text-muted-foreground">{t("timelineEmpty")}</p>;

  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const last = index === events.length - 1;
        return (
          <DashboardTimelineItem key={event.id} current={last} last={last}>
            <p className="font-medium text-foreground">
              {event.from === null ? t("timelinePlaced") : t(`status.${event.to}`)}
            </p>
            <p className={FIELD_HINT}>
              <time dateTime={event.at} className="tabular-nums">
                {formatOrderDate(event.at, locale)}
              </time>
              {" · "}
              {t("timelineBy", { name: event.actorName })}
            </p>
          </DashboardTimelineItem>
        );
      })}
    </ol>
  );
}
