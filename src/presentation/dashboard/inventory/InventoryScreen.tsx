import { AlertTriangle, Boxes, CircleAlert, CircleCheck, PackageX } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { InventorySummary, StockLevel } from "@/src/domain/entities/Inventory";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { StatCard } from "../StatCard";

import { ReorderLevelField } from "./ReorderLevelField";
import { StockLevelBadge } from "./StockLevelBadge";
import { WasteDialog } from "./WasteDialog";

type InventoryScreenProps = {
  summary: InventorySummary;
  /** `all`, or just the items that are low / out. */
  filter: "all" | "low" | "out";
  canManage: boolean;
};

/** Row tint by level, so a glance down the list finds what needs ordering. */
const ROW_TONE: Record<StockLevel, string> = {
  out: "bg-error/60",
  low: "bg-warning/60",
  ok: "",
};
const QUANTITY_TONE: Record<StockLevel, string> = {
  out: "text-error-foreground",
  low: "text-warning-foreground",
  ok: "text-foreground",
};

/**
 * What's on the shelves. Items at or below their reorder level show in the
 * warning colour, empty ones in red; with access to the books, each item's value
 * and the check that stock equals the Inventory account.
 */
export async function InventoryScreen({ summary, filter, canManage }: InventoryScreenProps) {
  const t = await getTranslations("dashInventory");
  const locale = await getLocale();
  const items = summary.items.filter((item) => item.isActive && (filter === "all" || item.level === filter));
  const reconciled = Math.abs(summary.difference) < 1;

  const chip = (active: boolean) =>
    cn(
      "flex h-9 items-center gap-1.5 rounded-full border px-4 text-button-default-medium transition-colors",
      focusRing,
      active ? "border-primary bg-accent text-primary" : "border-border text-foreground hover:bg-muted",
    );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="mt-1 text-body-small text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/inventory/movements">{t("movements.heading")}</Link>
          </Button>
          {canManage ? (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/inventory/count">{t("count.heading")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/dashboard/inventory/receive">{t("receive.heading")}</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={t("summary.low")}
          value={formatNumber(summary.lowCount, locale)}
          hint={t("summary.lowHint")}
          icon={AlertTriangle}
          tone={summary.lowCount > 0 ? "warning" : "brand"}
          href="/dashboard/inventory?level=low"
        />
        <StatCard
          label={t("summary.out")}
          value={formatNumber(summary.outCount, locale)}
          hint={t("summary.outHint")}
          icon={PackageX}
          tone={summary.outCount > 0 ? "danger" : "brand"}
          href="/dashboard/inventory?level=out"
        />
        {summary.costsVisible ? (
          <StatCard
            label={t("summary.value")}
            value={formatMoney(summary.stockValue, locale)}
            hint={t("summary.valueHint")}
            icon={Boxes}
            tone="info"
          />
        ) : null}
      </div>

      {summary.costsVisible ? (
        <p
          className={
            reconciled
              ? "flex items-center gap-2 text-body-small text-success-foreground"
              : "flex items-start gap-2 rounded-card-md border border-warning-foreground bg-warning px-4 py-3 text-body-small text-warning-foreground"
          }
        >
          {reconciled ? (
            <CircleCheck className="size-4 shrink-0" aria-hidden />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          {reconciled
            ? t("summary.reconciled")
            : t("summary.notReconciled", {
                stock: formatMoney(summary.stockValue, locale),
                books: formatMoney(summary.booksValue, locale),
              })}
        </p>
      ) : null}

      <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
        {(["all", "low", "out"] as const).map((option) => (
          <Link
            key={option}
            href={option === "all" ? "/dashboard/inventory" : `/dashboard/inventory?level=${option}`}
            className={chip(filter === option)}
            aria-current={filter === option ? "page" : undefined}
          >
            {t(`filter.${option}`)}
          </Link>
        ))}
      </nav>

      <section className="min-w-0 overflow-x-auto rounded-card-lg border border-border bg-background">
        {items.length === 0 ? (
          <EmptyState
            icon={filter === "all" ? Boxes : CircleCheck}
            title={filter === "all" ? t("empty") : t("emptyFiltered")}
            action={
              filter === "all" ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/pricing/ingredients">{t("addItems")}</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full min-w-[44rem] text-body-small">
            <thead className="bg-surface text-body-caption text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {t("col.item")}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-medium">
                  {t("col.onHand")}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {t("col.reorder")}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {t("col.status")}
                </th>
                {summary.costsVisible ? (
                  <>
                    <th scope="col" className="px-4 py-3 text-end font-medium">
                      {t("col.averageCost")}
                    </th>
                    <th scope="col" className="px-4 py-3 text-end font-medium">
                      {t("col.value")}
                    </th>
                  </>
                ) : null}
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const unit = t(`unit.${item.unit}`);
                return (
                  <tr key={item.id} className={ROW_TONE[item.level]}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/inventory/movements?item=${item.id}`}
                        className="text-body-small-emphasis text-foreground underline-offset-4 hover:underline"
                        dir="auto"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-end text-body-small-emphasis whitespace-nowrap",
                        QUANTITY_TONE[item.level],
                      )}
                    >
                      {formatNumber(item.onHand, locale, 3)} {unit}
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <ReorderLevelField id={item.id} reorderLevel={item.reorderLevel} unit={unit} />
                      ) : item.reorderLevel !== undefined ? (
                        `${formatNumber(item.reorderLevel, locale, 3)} ${unit}`
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StockLevelBadge level={item.level} />
                    </td>
                    {summary.costsVisible ? (
                      <>
                        <td className="px-4 py-3 text-end whitespace-nowrap text-muted-foreground">
                          {t("perUnit", { cost: formatNumber(item.averageCost, locale, 2), unit })}
                        </td>
                        <td className="px-4 py-3 text-end whitespace-nowrap">{formatMoney(item.value, locale)}</td>
                      </>
                    ) : null}
                    <td className="px-4 py-3 text-end">
                      <WasteDialog id={item.id} name={item.name} unit={unit} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {canManage ? (
        <p className="text-body-caption text-muted-foreground">
          {t("openingHint")}{" "}
          <Link href="/dashboard/inventory/opening" className="font-medium text-primary underline underline-offset-4">
            {t("opening.heading")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
