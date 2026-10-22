import { AlertTriangle, Boxes, CircleAlert, CircleCheck, History, PackageX, SearchX, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { InventorySummary, StockItem, StockLevel } from "@/src/domain/entities/Inventory";
import { Link } from "@/src/i18n/navigation";
import { formatMoney, moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { ListSearchInput } from "@/src/presentation/dashboard/list";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardLinkTabs } from "../DashboardLinkTabs";

import { InventoryHeaderActions } from "./InventoryHeaderActions";
import { InventoryStatCard } from "./InventoryStatCard";
import { StockDialogsProvider } from "./StockDialogsProvider";
import { STOCK_COLUMNS, StockRow } from "./StockRow";

/** The lists the page can show: every item, or just the ones low or out. */
export const INVENTORY_VIEWS = ["all", "low", "out"] as const;
export type InventoryView = (typeof INVENTORY_VIEWS)[number];

type InventoryScreenProps = {
  summary: InventorySummary;
  view: InventoryView;
  /** The search, when one is applied — to tell "nothing here" from "no matches". */
  query: string | undefined;
  /** Today on the cafe calendar — the date the dialogs book entries on. */
  today: string;
  canManage: boolean;
};

/** Out first, then low, then the rest — what needs ordering is read first. */
const LEVEL_RANK: Record<StockLevel, number> = { out: 0, low: 1, ok: 2 };

/**
 * What's on the shelves. Running low, Out of stock and the stock value across the
 * top — the first two also filter the list — then every item in All / Running low
 * / Out of stock tabs with a search, the ones that need ordering first. From the
 * header or an item's "⋯": receive a delivery, count stock, change a reorder
 * level or write off waste, each previewing the result before it's saved.
 * Presentational: the page fetches over the REST API (BFF); every write
 * `router.refresh()`es.
 */
export async function InventoryScreen({ summary, view, query, today, canManage }: InventoryScreenProps) {
  const t = await getTranslations("dashInventory");
  const locale = await getLocale();

  const active = summary.items.filter((item) => item.isActive);
  const inView = (item: StockItem, tab: InventoryView): boolean => tab === "all" || item.level === tab;
  const term = query?.toLowerCase();
  const shown = active
    .filter((item) => inView(item, view) && (!term || item.name.toLowerCase().includes(term)))
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.name.localeCompare(b.name, locale));
  const countOf = (tab: InventoryView): number => active.filter((item) => inView(item, tab)).length;
  const low = countOf("low");
  const out = countOf("out");
  const reconciled = Math.abs(summary.difference) < 1;
  const firstToOrder = active.find((item) => item.level !== "ok") ?? active[0];

  const hrefFor = (tab: InventoryView, withQuery = true): string => {
    const params = new URLSearchParams();
    if (tab !== "all") params.set("level", tab);
    if (withQuery && query) params.set("q", query);
    const qs = params.toString();
    return qs ? `/dashboard/inventory?${qs}` : "/dashboard/inventory";
  };

  return (
    <StockDialogsProvider items={active} costsVisible={summary.costsVisible} today={today}>
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="dashboard-page-title">{t("heading")}</h1>
            <p className="text-body-default text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" className="gap-2 px-3">
              <Link href="/dashboard/inventory/movements">
                <Icon icon={History} size="sm" />
                {t("movements.heading")}
              </Link>
            </Button>
            {canManage ? <InventoryHeaderActions countItemId={active[0]?.id} receiveItemId={firstToOrder?.id} /> : null}
          </div>
        </div>

        <div className={cn("grid grid-cols-2 gap-3", summary.costsVisible && "sm:grid-cols-3")}>
          <InventoryStatCard
            label={t("summary.low")}
            icon={AlertTriangle}
            value={formatNumber(low, locale)}
            hint={t("summary.lowHint")}
            alert={low > 0 ? "warning" : undefined}
            href={view === "low" ? hrefFor("all", false) : hrefFor("low", false)}
            selected={view === "low"}
          />
          <InventoryStatCard
            label={t("summary.out")}
            icon={PackageX}
            value={formatNumber(out, locale)}
            hint={out > 0 ? t("summary.outHint") : t("summary.outNone")}
            alert={out > 0 ? "danger" : undefined}
            href={view === "out" ? hrefFor("all", false) : hrefFor("out", false)}
            selected={view === "out"}
          />
          {summary.costsVisible ? (
            <InventoryStatCard
              label={t("summary.value")}
              icon={Wallet}
              value={formatNumber(Math.round(summary.stockValue), locale)}
              unit={moneyUnit(locale)}
              hint={reconciled ? t("summary.valueHintReconciled") : t("summary.valueHint")}
              className="col-span-2 sm:col-span-1"
            />
          ) : null}
        </div>

        {summary.costsVisible && !reconciled ? (
          <p className="flex items-start gap-2 rounded-card-md border border-warning-border bg-warning px-4 py-3 text-body-default text-pretty text-warning-foreground sm:text-body-small">
            <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
            {t("summary.notReconciled", {
              stock: formatMoney(summary.stockValue, locale),
              books: formatMoney(summary.booksValue, locale),
            })}
          </p>
        ) : null}

        <section
          aria-label={t("listLabel")}
          className="@container/stock min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
        >
          <DashboardLinkTabs
            className="px-4"
            label={t("filterLabel")}
            current={view}
            tabs={INVENTORY_VIEWS.map((tab) => ({
              key: tab,
              label: t(`filter.${tab}`),
              count: countOf(tab),
              href: hrefFor(tab),
            }))}
          />
          <div className="border-b border-border px-4 py-3">
            <ListSearchInput label={t("searchLabel")} placeholder={t("searchPlaceholder")} className="max-w-md" />
          </div>

          {shown.length > 0 ? (
            <>
              <div
                aria-hidden
                className={cn(
                  "hidden h-10 items-center gap-x-4 border-b border-border bg-muted px-5 text-body-caption-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase @2xl/stock:grid",
                  summary.costsVisible ? STOCK_COLUMNS.withCosts : STOCK_COLUMNS.withoutCosts,
                )}
              >
                <span>{t("col.item")}</span>
                <span className="text-end">{t("col.onHand")}</span>
                <span className="text-end">{t("col.reorder")}</span>
                {summary.costsVisible ? <span className="text-end">{t("col.value")}</span> : null}
                <span />
              </div>
              <ul>
                {shown.map((item, index) => (
                  <li key={item.id} className={cn(index > 0 && "border-t border-border")}>
                    <StockRow item={item} costsVisible={summary.costsVisible} canManage={canManage} />
                  </li>
                ))}
              </ul>
            </>
          ) : query ? (
            <EmptyState icon={SearchX} title={t("noMatchesTitle")} description={t("noMatchesBody")} className="py-12" />
          ) : view !== "all" ? (
            <EmptyState icon={CircleCheck} title={t("allGoodTitle")} description={t("allGoodBody")} className="py-12" />
          ) : (
            <EmptyState
              icon={Boxes}
              title={t("emptyTitle")}
              description={t("emptyBody")}
              className="py-12"
              action={
                canManage ? (
                  <Button asChild size="sm">
                    <Link href="/dashboard/pricing/ingredients">{t("addItems")}</Link>
                  </Button>
                ) : undefined
              }
            />
          )}
        </section>

        {canManage ? (
          <p className="text-body-small text-muted-foreground sm:text-body-caption">
            {t("openingHint")}{" "}
            <Link
              href="/dashboard/inventory/opening"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
            >
              {t("opening.heading")}
            </Link>
          </p>
        ) : null}
      </div>
    </StockDialogsProvider>
  );
}
