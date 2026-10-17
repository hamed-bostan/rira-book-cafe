import { Bell, BedDouble, BookOpen, CalendarClock, ClipboardList, Gift, Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { Notification, NotificationKind } from "@/src/domain/entities/Notification";
import { Link } from "@/src/i18n/navigation";
import { formatRelativeTime } from "@/src/lib/formatRelativeTime";
import { cn } from "@/src/lib/utils";
import { Icon, focusRing } from "@/src/presentation/design-system";

import { MarkNotificationsRead } from "./MarkNotificationsRead";
import { notificationValues } from "./notificationValues";

import type { LucideIcon } from "lucide-react";

type NotificationsScreenProps = {
  notifications: Notification[];
  /** "Now", from the page, so "5 minutes ago" is judged on the server's clock. */
  now: string;
};

const ICONS: Record<NotificationKind, LucideIcon> = {
  orderAccepted: ClipboardList,
  orderReady: ClipboardList,
  orderCompleted: ClipboardList,
  orderCancelled: ClipboardList,
  reservationConfirmed: CalendarClock,
  reservationCancelled: CalendarClock,
  suiteConfirmed: BedDouble,
  suiteCancelled: BedDouble,
  loanStarted: BookOpen,
  loanDueSoon: BookOpen,
  loanOverdue: BookOpen,
  bookAvailable: BookOpen,
  pointsEarned: Gift,
  reviewApproved: Star,
};

/** Kinds that ask the guest to do something — drawn in the warning tone. */
const URGENT: ReadonlySet<NotificationKind> = new Set(["orderReady", "loanOverdue", "bookAvailable"]);

/**
 * The guest's inbox: what happened to their orders, bookings and borrowed books,
 * newest first. Unread ones are highlighted on this visit, then marked read.
 */
export async function NotificationsScreen({ notifications, now }: NotificationsScreenProps) {
  const t = await getTranslations("site");
  const locale = await getLocale();
  const nowDate = new Date(now);
  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-heading-page text-foreground">{t("notifications.heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("notifications.subtitle")}</p>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card-lg border border-dashed border-border px-6 py-12 text-center">
          <Icon icon={Bell} size="lg" className="text-muted-foreground" />
          <p className="text-body-small text-muted-foreground">{t("notifications.empty")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((notification) => {
            const values = notificationValues(notification, locale);
            const className = cn(
              "flex items-start gap-3 rounded-card-md border p-3",
              notification.readAt ? "border-border" : "border-primary/40 bg-accent",
            );
            const content = (
              <>
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full",
                    URGENT.has(notification.kind) ? "bg-warning text-warning-foreground" : "bg-accent text-primary",
                  )}
                >
                  <Icon icon={ICONS[notification.kind]} size="sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body-small-strong text-foreground">{t(`notifications.kinds.${notification.kind}.title`, values)}</span>
                  <span className="block text-body-small text-muted-foreground">{t(`notifications.kinds.${notification.kind}.body`, values)}</span>
                  <span className="mt-1 block text-body-caption text-muted-foreground">{formatRelativeTime(notification.createdAt, locale, nowDate)}</span>
                </span>
                {notification.readAt ? null : (
                  <span role="img" aria-label={t("notifications.unread")} className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                )}
              </>
            );
            return (
              <li key={notification.id}>
                {notification.link ? (
                  <Link href={notification.link} className={cn(className, "hover:bg-muted", focusRing)}>
                    {content}
                  </Link>
                ) : (
                  <div className={className}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <MarkNotificationsRead unread={unread} />
    </div>
  );
}
