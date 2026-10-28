import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { kitchenWaitTone, type KitchenWaitTone } from "@/src/domain/entities/Kitchen";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { kitchenWaitMessage } from "./kitchenWait";

const TONE: Record<KitchenWaitTone, string> = {
  neutral: "border-border bg-muted text-foreground",
  warning: "border-warning-border bg-warning text-warning-foreground",
  late: "border-error-border bg-error text-error-foreground",
};

type KitchenWaitPillProps = {
  /** Whole minutes the order has waited. */
  minutes: number;
  /** When it was placed (ISO), shown on hover. */
  placedAt: string;
};

/**
 * How long a ticket has waited, readable across the bar: neutral, amber from ten
 * minutes, red with "· Late" from fifteen. Hovering shows when it was placed.
 */
export function KitchenWaitPill({ minutes, placedAt }: KitchenWaitPillProps) {
  const t = useTranslations("dashKitchen");
  const locale = useLocale();
  const tone = kitchenWaitTone(minutes);
  const message = kitchenWaitMessage(minutes, locale);
  const wait =
    message.key === "justNow"
      ? t("wait.justNow")
      : message.key === "minutes"
        ? t("wait.minutes", message.values)
        : t("wait.hours", message.values);

  return (
    <span
      title={t("placed", { time: formatOrderTime(placedAt, locale) })}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-button border px-3 text-body-strong whitespace-nowrap tabular-nums",
        TONE[tone],
      )}
    >
      <Icon icon={Clock} size="icon-md" strokeWidth={2} />
      {tone === "late" ? t("wait.late", { wait }) : wait}
    </span>
  );
}
