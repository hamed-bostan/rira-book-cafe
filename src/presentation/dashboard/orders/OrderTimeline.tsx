import { History } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { EmptyState } from "@/src/presentation/design-system";

/** The order's status history, oldest first: when it came in, and who moved it at each step. */
export async function OrderTimeline({ events }: { events: OrderStatusEvent[] }) {
  const t = await getTranslations("dashOrders");
  const locale = await getLocale();

  if (events.length === 0) return <EmptyState icon={History} title={t("timelineEmpty")} className="py-8" />;

  return (
    <ol className="flex flex-col gap-4 border-s border-border ps-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span aria-hidden className="absolute -start-[1.3rem] top-1.5 size-2.5 rounded-full bg-primary" />
          <p className="text-body-small-emphasis text-foreground">
            {event.from === null ? t("timelinePlaced") : t(`status.${event.to}`)}
          </p>
          <p className="text-body-caption text-muted-foreground">
            <time dateTime={event.at}>{formatOrderDate(event.at, locale)}</time>
            {" · "}
            {t("timelineBy", { name: event.actorName })}
          </p>
        </li>
      ))}
    </ol>
  );
}
