import { getLocale, getTranslations } from "next-intl/server";

import { orderList, type OrderSuggestion, type StockItem } from "@/src/domain/entities/Inventory";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { cn } from "@/src/lib/utils";

import { PrintButton } from "../accounting/PrintButton";
import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardPageHeader } from "../DashboardPageHeader";
import { PAGE_CARD, ROW_CAPTION, ROW_TEXT, TABLE_HEAD, TABLE_TH } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";
import { STACKED_TABLE } from "../stackedTableStyles";

import { formatStockQuantity } from "./stockFormat";
import { StockLevelBadge } from "./StockLevelBadge";

/** Four columns: stacked rows under a tablet's card, the table from there up (and on paper). */
const S = STACKED_TABLE.compact;

type ToOrderScreenProps = {
  items: StockItem[];
  /** Today on the cafe calendar — printed on the sheet. */
  today: string;
};

/**
 * The shopping list: every item at or below its reorder level (or out), grouped by
 * who it's usually bought from, with how much to order — up to its par level,
 * in whole packs of its first purchase unit. An item with no par level says so
 * rather than guessing. Printable: the sheet keeps its columns on paper.
 */
export async function ToOrderScreen({ items, today }: ToOrderScreenProps) {
  const t = await getTranslations("dashInventory");
  const locale = await getLocale();
  const groups = orderList(items, locale);

  const quantity = (item: StockItem, value: number): string =>
    t("quick.quantity", { quantity: formatStockQuantity(value, locale), unit: t(`unit.${item.unit}`) });

  const suggestion = (item: StockItem, suggested: OrderSuggestion | null): string => {
    if (suggested === null) return t("toOrder.noPar");
    if (suggested.quantity === 0) return t("toOrder.atPar");
    if (!suggested.packs) return quantity(item, suggested.quantity);
    return t("toOrder.packs", {
      count: suggested.packs.count,
      formatted: formatStockQuantity(suggested.packs.count, locale),
      pack: suggested.packs.unit.name,
      quantity: quantity(item, suggested.quantity),
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("toOrder.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/inventory"
        backLabel={t("heading")}
        title={t("toOrder.heading")}
        subtitle={t("toOrder.subtitle")}
        actions={groups.length > 0 ? <PrintButton /> : undefined}
      />
      <p className={cn(ROW_CAPTION, "hidden print:block")}>
        {t("toOrder.printedOn", { date: formatCafeDayMedium(today, locale) })}
      </p>

      {groups.length === 0 ? (
        <section className={PAGE_CARD}>
          <DashboardEmptyState title={t("toOrder.emptyTitle")} body={t("toOrder.emptyBody")} />
        </section>
      ) : (
        groups.map((group) => (
          <section
            key={group.supplierId ?? "none"}
            aria-label={group.supplierName ?? t("toOrder.noSupplier")}
            className={cn(PAGE_CARD, S.frame, "break-inside-avoid overflow-hidden")}
          >
            <h2 className="border-b border-border px-5 py-3 text-body-strong text-foreground sm:text-body-small-strong">
              {group.supplierName ?? t("toOrder.noSupplier")}
            </h2>
            <table className={cn(ROW_TEXT, S.table)}>
              <thead className={cn(TABLE_HEAD, S.head)}>
                <tr>
                  <th scope="col" className={TABLE_TH}>
                    {t("col.item")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                    {t("col.onHand")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                    {t("toOrder.levels")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-56 text-end")}>
                    {t("toOrder.suggested")}
                  </th>
                </tr>
              </thead>
              <tbody className={cn(S.body, "divide-y divide-border")}>
                {group.lines.map(({ item, suggestion: suggested }) => (
                  <tr key={item.id} className={S.row}>
                    <td className={cn(S.lead, "align-middle font-medium text-foreground")}>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span dir="auto">{item.name}</span>
                        {item.level !== "ok" ? <StockLevelBadge level={item.level} /> : null}
                      </span>
                    </td>
                    <td className={cn(S.cell, S.amount, "align-middle text-foreground")}>
                      <span className={S.label}>{t("col.onHand")}</span>
                      {quantity(item, item.onHand)}
                    </td>
                    <td className={cn(S.cell, S.amount, "align-middle text-foreground/80")}>
                      <span className={S.label}>{t("toOrder.levels")}</span>
                      {t("toOrder.levelsValue", {
                        reorder: item.reorderLevel === undefined ? "—" : quantity(item, item.reorderLevel),
                        par: item.parLevel === undefined ? "—" : quantity(item, item.parLevel),
                      })}
                    </td>
                    <td className={cn(S.cell, S.amount, "align-middle font-semibold text-foreground")}>
                      <span className={S.label}>{t("toOrder.suggested")}</span>
                      {suggestion(item, suggested)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}
