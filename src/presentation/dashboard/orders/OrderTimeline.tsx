import { getLocale, getTranslations } from "next-intl/server";

import type { OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { DashboardTimelineItem } from "@/src/presentation/dashboard/DashboardTimelineItem";
import { FIELD_HINT } from "@/src/presentation/dashboard/fieldStyles";

/**
 * The order's status history, oldest first: when it came in, who moved it at each
 * step, and when staff changed it in between.
 */
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
              {event.kind === "changed"
                ? // Staff changed the order without moving it; the activity log says what.
                  t("timelineChanged")
                : event.from === null
                  ? t("timelinePlaced")
                  : // The one way a served order is cancelled: written off.
                    event.from === "completed" && event.to === "cancelled"
                    ? t("timelineWrittenOff")
                    : t(`status.${event.to}`)}
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
