"use client";

import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { Order } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

/** A new order as the bell lists it. */
export type NewOrderNotice = Pick<Order, "id" | "orderNumber" | "serviceType" | "tableLabel" | "placedAt">;

/** When this browser last marked the bell read — a per-device convenience, not shared state. */
const SEEN_KEY = "rira.dashboard.notificationsSeenAt";
const SEEN_EVENT = "rira:notifications-seen";

function readSeenAt(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SEEN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SEEN_EVENT, onChange);
  };
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
  } catch {
    // Storage blocked (private window): the dot just stays until the orders move on.
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

type NotificationsMenuProps = {
  /** Orders waiting to be picked up, newest first — fetched with the shell. */
  orders: NewOrderNotice[];
};

/**
 * The top bar's bell: orders that came in and nobody has picked up yet, newest
 * first, each opening its order. The dot means one arrived since this browser
 * last marked the list read.
 *
 * The list itself is server data (it refreshes with the page); only "when did I
 * last look" lives here, in `localStorage`, because it belongs to this screen at
 * this counter rather than to the order.
 */
export function NotificationsMenu({ orders }: NotificationsMenuProps) {
  const t = useTranslations("dashboard");
  const tOrders = useTranslations("dashOrders");
  const locale = useLocale();
  const router = useRouter();
  // `undefined` on the server and during hydration: the stored time isn't known yet.
  const seenAt = React.useSyncExternalStore<string | null | undefined>(subscribe, readSeenAt, () => undefined);

  // Before hydration `seenAt` is unknown, so nothing counts as unread — the dot
  // appears after rather than flashing on and off.
  const isUnread = (order: NewOrderNotice): boolean =>
    seenAt !== undefined && (seenAt === null || order.placedAt > seenAt);
  const hasUnread = orders.some(isUnread);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={hasUnread ? t("notificationsUnread") : t("notifications")}
          className={cn(
            "relative flex size-10 shrink-0 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            focusRing,
          )}
        >
          <Icon icon={Bell} size="sm" />
          {hasUnread ? (
            <span aria-hidden className="absolute end-2 top-2 size-2 rounded-full bg-primary ring-2 ring-background" />
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="mb-1 flex items-center justify-between gap-3 border-b border-border px-3 pt-2 pb-3">
          <span className="text-body-small-strong text-foreground">{t("notifications")}</span>
          {hasUnread ? (
            <button
              type="button"
              onClick={markSeen}
              className={cn(
                "text-body-small-emphasis text-primary transition-colors hover:text-primary-hover",
                focusRing,
              )}
            >
              {t("markAllRead")}
            </button>
          ) : null}
        </div>

        {orders.length === 0 ? (
          <p className="px-3 py-4 text-body-small text-muted-foreground">{t("notificationsEmpty")}</p>
        ) : (
          orders.map((order) => {
            const unread = isUnread(order);
            return (
              <DropdownMenuItem
                key={order.id}
                onSelect={() => router.push(`/dashboard/orders/${order.id}`)}
                className="items-start gap-3 px-3"
              >
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={cn("text-body-small text-foreground", unread && "font-semibold")}>
                    {t("newOrder", { number: order.orderNumber })}
                  </span>
                  <span className="text-body-caption text-muted-foreground">
                    {order.serviceType === "dineIn"
                      ? tOrders("table", { table: order.tableLabel ?? "?" })
                      : tOrders("service.takeaway")}
                    {" · "}
                    {formatOrderTime(order.placedAt, locale)}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
