import { useLocale, useTranslations } from "next-intl";

import { lateOrderCount, type KitchenLane as KitchenLaneKey } from "@/src/domain/entities/Kitchen";
import type { Order } from "@/src/domain/entities/Order";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { KitchenTicket } from "./KitchenTicket";

/** The lane's colour dot: amber for new orders, blue for those being made. */
const DOT: Record<KitchenLaneKey, string> = {
  new: "bg-warning-foreground",
  making: "bg-info-foreground",
};

/**
 * Two tickets a row on a wide screen (from 1536px, or 1280px once the board is
 * full screen and the rail has stepped aside), one otherwise. Written out in full
 * so Tailwind finds it; the attribute is `DASHBOARD_FULL_SCREEN_ATTRIBUTE`.
 */
const TICKET_GRID =
  "grid grid-cols-1 items-start gap-3 2xl:grid-cols-2 xl:[html[data-dashboard-full-screen]_&]:grid-cols-2";

type KitchenLaneProps = {
  lane: KitchenLaneKey;
  /** The lane's orders, oldest first. */
  orders: readonly Order[];
  now: Date;
  /** "Table 2" or "Takeaway" for an order. */
  serviceOf: (order: Order) => string;
  canFulfill: boolean;
};

/**
 * One column of the board: its dot, name and count, a red "2 late" when any of
 * its tickets has waited too long, and the tickets oldest first — or a dashed box
 * saying what lands here.
 */
export function KitchenLane({ lane, orders, now, serviceOf, canFulfill }: KitchenLaneProps) {
  const t = useTranslations("dashKitchen");
  const locale = useLocale();
  const late = lateOrderCount(orders, now);
  const headingId = `lane-${lane}`;

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3 rounded-card-lg bg-muted p-3">
      <div className="flex items-center gap-2 px-2 pt-1">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[lane])} />
        <h2 id={headingId} className="text-body-strong text-foreground">
          {t(`lane.${lane}`)}
        </h2>
        <span className="inline-flex h-5 min-w-6 items-center justify-center rounded-badge-md bg-background px-1.5 text-label-compact leading-4 text-foreground tabular-nums">
          {formatNumber(orders.length, locale)}
        </span>
        {late > 0 ? (
          <span className="ms-auto text-body-small font-semibold whitespace-nowrap text-error-foreground sm:text-body-caption">
            {t("lateCount", { count: formatNumber(late, locale) })}
          </span>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-card-lg border border-dashed border-border-strong px-4 py-12 text-center">
          <p className="text-body-strong text-foreground sm:text-body-small-strong">{t("laneEmpty")}</p>
          <p className="text-body-small text-muted-foreground sm:text-body-caption">{t(`laneEmptyHint.${lane}`)}</p>
        </div>
      ) : (
        <div className={TICKET_GRID}>
          {orders.map((order) => (
            <KitchenTicket key={order.id} order={order} now={now} service={serviceOf(order)} canFulfill={canFulfill} />
          ))}
        </div>
      )}
    </section>
  );
}
