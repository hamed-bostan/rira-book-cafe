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
import { PAGE_CARD, ROW_CAPTION, ROW_TEXT, TABLE_HEAD, TABLE_TH } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";
import { STACKED_TABLE } from "../stackedTableStyles";

import { formatStockQuantity } from "./stockFormat";

/** Five or six columns: stacked rows under a laptop's card, the table from there up. */
const S = STACKED_TABLE.wide;

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

/**
 * Where each item's stock went: deliveries, sales, waste, counts — newest first.
 * A table on a laptop's card; on a narrower one each movement leads with its item,
 * the rest labelled under it.
 */
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

      <section aria-label={t("movements.heading")} className={cn(PAGE_CARD, S.frame, "overflow-hidden")}>
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
          <table className={cn(ROW_TEXT, S.table)}>
            <thead className={cn(TABLE_HEAD, S.head)}>
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
                <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                  {t("movements.quantity")}
                </th>
                {costsVisible ? (
                  <th scope="col" className={cn(TABLE_TH, "w-40 text-end")}>
                    {t("col.value")}
                  </th>
                ) : null}
                <th scope="col" className={cn(TABLE_TH, "w-36")}>
                  {t("movements.by")}
                </th>
              </tr>
            </thead>
            <tbody className={cn(S.body, "divide-y divide-border")}>
              {page.items.map((movement) => {
                const href = referenceHref(movement);
                const unit = t(`unit.${units.get(movement.ingredientId) ?? "piece"}`);
                const kind = (
                  <Badge size="compact" variant={KIND_VARIANT[movement.kind]} appearance="outline">
                    {t(`kind.${movement.kind}`)}
                  </Badge>
                );
                return (
                  <tr key={movement.id} className={S.row}>
                    <td className={cn(S.cell, "align-middle whitespace-nowrap text-muted-foreground")}>
                      <span className={S.label}>{t("dateLabel")}</span>
                      {formatCafeDayMedium(movement.date, locale)}
                    </td>
                    {/* The item leads the row when stacked. */}
                    <td className={cn(S.lead, "order-first align-middle font-medium text-foreground")} dir="auto">
                      {movement.ingredientName}
                    </td>
                    <td className={cn(S.cell, "align-middle")}>
                      <span className={S.label}>{t("movements.kindLabel")}</span>
                      <span className="flex flex-col items-start gap-0.5">
                        {href ? (
                          // 44px to the touch on a phone without moving the badge.
                          <Link href={href} className="-my-2.5 inline-flex py-2.5 sm:my-0 sm:py-0">
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
                        S.cell,
                        S.amount,
                        "align-middle font-semibold",
                        movement.quantity < 0 ? "text-foreground" : "text-success-foreground",
                      )}
                    >
                      <span className={S.label}>{t("movements.quantity")}</span>
                      <span>
                        <span dir="ltr">
                          {movement.quantity > 0 ? "+" : ""}
                          {formatStockQuantity(movement.quantity, locale)}
                        </span>{" "}
                        {unit}
                      </span>
                    </td>
                    {costsVisible ? (
                      <td className={cn(S.cell, S.amount, "align-middle text-foreground")}>
                        <span className={S.label}>{t("col.value")}</span>
                        {formatMoney(movement.value, locale)}
                      </td>
                    ) : null}
                    <td className={cn(S.cell, "align-middle text-foreground/80")}>
                      <span className={S.label}>{t("movements.by")}</span>
                      {movement.createdByName}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="border-t border-border px-5 py-3">
          <ListPager page={page} />
        </div>
      </section>
    </div>
  );
}
