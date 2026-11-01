import { getLocale, getTranslations } from "next-intl/server";

import {
  STOCK_MOVEMENT_KINDS,
  type StockItem,
  type StockMovement,
  type StockMovementKind,
} from "@/src/domain/entities/Inventory";
import type { Page } from "@/src/domain/entities/Pagination";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { ListFilterSelect, ListPager } from "@/src/presentation/dashboard/list";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardPageHeader } from "../DashboardPageHeader";
import { FIELD_LABEL } from "../fieldStyles";
import { AMOUNT, PAGE_CARD, ROW_CAPTION, ROW_TEXT, TABLE_HEAD, TABLE_TD, TABLE_TH } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { formatStockQuantity } from "./stockFormat";

/** Each kind's tint, read down the Type column. */
const KIND_VARIANT: Record<StockMovementKind, BadgeProps["variant"]> = {
  opening: "neutral",
  receipt: "success",
  sale: "info",
  waste: "error",
  count: "warning",
  return: "info",
};

type MovementsScreenProps = { page: Page<StockMovement>; items: StockItem[]; costsVisible: boolean };

/** Where each item's stock went: deliveries, sales, waste, counts — newest first. */
export async function MovementsScreen({ page, items, costsVisible }: MovementsScreenProps) {
  const t = await getTranslations("dashInventory");
  const locale = await getLocale();
  const units = new Map(items.map((item) => [item.id, item.unit]));

  const referenceHref = (movement: StockMovement): string | null => {
    if (!movement.referenceId) return null;
    if (movement.kind === "sale" || movement.kind === "return") return `/dashboard/orders/${movement.referenceId}`;
    if (movement.kind === "receipt") return `/dashboard/expenses/${movement.referenceId}`;
    return null;
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("movements.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/inventory"
        backLabel={t("heading")}
        title={t("movements.heading")}
        subtitle={t("movements.subtitle")}
      />

      <section aria-label={t("movements.heading")} className={cn(PAGE_CARD, "overflow-hidden")}>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className={FIELD_LABEL}>{t("col.item")}</span>
            <ListFilterSelect
              className="min-w-48 border-border-strong"
              paramName="item"
              label={t("col.item")}
              options={[
                { value: "", label: t("movements.allItems") },
                ...items.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className={FIELD_LABEL}>{t("movements.kindLabel")}</span>
            <ListFilterSelect
              className="min-w-40 border-border-strong"
              paramName="kind"
              label={t("movements.kindLabel")}
              options={[
                { value: "", label: t("movements.allKinds") },
                ...STOCK_MOVEMENT_KINDS.map((kind) => ({ value: kind, label: t(`kind.${kind}`) })),
              ]}
            />
          </div>
        </div>

        {page.items.length === 0 ? (
          <p className={cn(ROW_TEXT, "px-5 py-12 text-center font-semibold text-foreground")}>{t("movements.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={cn(ROW_TEXT, "w-full min-w-2xl table-fixed")}>
              <thead className={TABLE_HEAD}>
                <tr>
                  <th scope="col" className={cn(TABLE_TH, "w-36")}>
                    {t("dateLabel")}
                  </th>
                  <th scope="col" className={TABLE_TH}>
                    {t("col.item")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-44")}>
                    {t("movements.kindLabel")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-32 text-end")}>
                    {t("movements.quantity")}
                  </th>
                  {costsVisible ? (
                    <th scope="col" className={cn(TABLE_TH, "w-40 text-end")}>
                      {t("col.value")}
                    </th>
                  ) : null}
                  <th scope="col" className={cn(TABLE_TH, "w-40")}>
                    {t("movements.by")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.items.map((movement) => {
                  const href = referenceHref(movement);
                  const unit = t(`unit.${units.get(movement.ingredientId) ?? "piece"}`);
                  const kind = (
                    <Badge size="compact" variant={KIND_VARIANT[movement.kind]} appearance="outline">
                      {t(`kind.${movement.kind}`)}
                    </Badge>
                  );
                  return (
                    <tr key={movement.id}>
                      <td className={cn(TABLE_TD, "align-middle whitespace-nowrap text-muted-foreground")}>
                        {formatCafeDayMedium(movement.date, locale)}
                      </td>
                      <td className={cn(TABLE_TD, "align-middle font-medium text-foreground")} dir="auto">
                        {movement.ingredientName}
                      </td>
                      <td className={cn(TABLE_TD, "align-middle")}>
                        <span className="flex flex-col items-start gap-0.5">
                          {href ? (
                            <Link href={href} className="inline-flex">
                              {kind}
                            </Link>
                          ) : (
                            kind
                          )}
                          {movement.note ? (
                            <span className={ROW_CAPTION} dir="auto">
                              {movement.note}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td
                        className={cn(
                          TABLE_TD,
                          AMOUNT,
                          "align-middle font-semibold",
                          movement.quantity < 0 ? "text-foreground" : "text-success-foreground",
                        )}
                      >
                        {movement.quantity > 0 ? "+" : ""}
                        {formatStockQuantity(movement.quantity, locale)} {unit}
                      </td>
                      {costsVisible ? (
                        <td className={cn(TABLE_TD, AMOUNT, "align-middle text-foreground")}>
                          {formatMoney(movement.value, locale)}
                        </td>
                      ) : null}
                      <td className={cn(TABLE_TD, "align-middle text-foreground/80")}>{movement.createdByName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border px-5 py-3">
          <ListPager page={page} />
        </div>
      </section>
    </div>
  );
}
