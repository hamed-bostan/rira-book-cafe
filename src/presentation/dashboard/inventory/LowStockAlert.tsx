import { AlertTriangle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { StockItem } from "@/src/domain/entities/Inventory";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

/** How many items the dashboard names before "and N more". */
const SHOWN = 6;

/**
 * The dashboard's stock warning: items out of stock (red) and running low (the
 * warning colour), so the owner sees what to order without opening Inventory.
 * Renders nothing when everything is stocked.
 */
export async function LowStockAlert({ items }: { items: StockItem[] }) {
  const t = await getTranslations("dashInventory");
  const locale = await getLocale();
  const alerts = items
    .filter((item) => item.isActive && item.level !== "ok")
    .sort((a, b) => (a.level === b.level ? a.name.localeCompare(b.name) : a.level === "out" ? -1 : 1));
  if (alerts.length === 0) return null;
  const anyOut = alerts.some((item) => item.level === "out");

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-card-lg border px-4 py-4 md:px-6",
        anyOut
          ? "border-error-foreground bg-error text-error-foreground"
          : "border-warning-foreground bg-warning text-warning-foreground",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="size-5 shrink-0" aria-hidden />
        <h2 className="text-body-strong">{t("alert.title", { count: alerts.length })}</h2>
        <Link
          href="/dashboard/inventory?level=low"
          className="ms-auto text-body-small-emphasis underline underline-offset-4"
        >
          {t("alert.open")}
        </Link>
      </div>
      <ul className="flex flex-wrap gap-2">
        {alerts.slice(0, SHOWN).map((item) => (
          <li
            key={item.id}
            className={cn(
              "rounded-full border px-3 py-1 text-body-caption",
              item.level === "out"
                ? "border-error-foreground bg-background text-error-foreground"
                : "border-warning-foreground bg-background text-warning-foreground",
            )}
          >
            <span dir="auto">{item.name}</span> ·{" "}
            {item.level === "out"
              ? t("level.out")
              : `${formatNumber(item.onHand, locale, 3)} ${t(`unit.${item.unit}`)}`}
          </li>
        ))}
        {alerts.length > SHOWN ? (
          <li className="px-1 py-1 text-body-caption">{t("alert.more", { count: alerts.length - SHOWN })}</li>
        ) : null}
      </ul>
    </section>
  );
}
