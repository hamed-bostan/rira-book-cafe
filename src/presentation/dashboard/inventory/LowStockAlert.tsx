import { AlertTriangle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { StockItem } from "@/src/domain/entities/Inventory";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

/** How many items the dashboard names before "and N more". */
const SHOWN = 6;

/**
 * The dashboard's stock warning, so the owner sees what to order without opening
 * Inventory. One red-tinted band for the whole warning; each item is a chip whose
 * dot says which kind of trouble — red for out, amber for low — beside the words
 * that say it too. Renders nothing when everything is stocked.
 */
export async function LowStockAlert({ items }: { items: StockItem[] }) {
  const t = await getTranslations("dashInventory");
  const locale = await getLocale();
  const alerts = items
    .filter((item) => item.isActive && item.level !== "ok")
    .sort((a, b) => (a.level === b.level ? a.name.localeCompare(b.name) : a.level === "out" ? -1 : 1));
  if (alerts.length === 0) return null;

  return (
    <section
      aria-labelledby="low-stock-alert"
      className="flex flex-col gap-3 rounded-card-lg border border-error-border bg-error px-5 py-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Icon icon={AlertTriangle} size="md" className="text-error-foreground sm:size-5" />
        <h2 id="low-stock-alert" className="text-body-strong text-foreground sm:text-body-small-strong">
          {t("alert.title", { count: alerts.length })}
        </h2>
        <Link
          href="/dashboard/inventory?level=low"
          // 44px tall to the touch on a phone, without moving the line.
          className={cn(
            "-my-3 ms-auto py-3 text-body-small-emphasis whitespace-nowrap text-foreground underline underline-offset-4 transition-colors hover:text-error-foreground sm:my-0 sm:py-0",
            focusRing,
          )}
        >
          {t("alert.open")}
        </Link>
      </div>
      <ul className="flex flex-wrap gap-2">
        {alerts.slice(0, SHOWN).map((item) => (
          <li
            key={item.id}
            className="flex h-8 items-center gap-2 rounded-badge-md border border-error-border bg-background px-3 text-body-caption-emphasis whitespace-nowrap text-foreground"
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                item.level === "out" ? "bg-error-foreground" : "bg-warning-foreground",
              )}
            />
            <span dir="auto">{item.name}</span> ·{" "}
            {item.level === "out"
              ? t("level.out")
              : `${formatNumber(item.onHand, locale, 3)} ${t(`unit.${item.unit}`)}`}
          </li>
        ))}
        {alerts.length > SHOWN ? (
          <li className="flex h-8 items-center px-1 text-body-caption text-foreground">
            {t("alert.more", { count: alerts.length - SHOWN })}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
