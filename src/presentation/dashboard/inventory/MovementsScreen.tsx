import { ChevronRight, History } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { STOCK_MOVEMENT_KINDS, type StockItem, type StockMovement } from "@/src/domain/entities/Inventory";
import type { Page } from "@/src/domain/entities/Pagination";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { ListFilterSelect, ListPager } from "@/src/presentation/dashboard/list";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

type MovementsScreenProps = { page: Page<StockMovement>; items: StockItem[]; costsVisible: boolean };

/** Where each item's stock went: deliveries, sales, waste, counts — newest first. */
export async function MovementsScreen({ page, items, costsVisible }: MovementsScreenProps) {
  const t = await getTranslations("dashInventory");
  const locale = await getLocale();
  const units = new Map(items.map((item) => [item.id, item.unit]));

  const referenceHref = (movement: StockMovement): string | null => {
    if (!movement.referenceId) return null;
    if (movement.kind === "sale") return `/dashboard/orders/${movement.referenceId}`;
    if (movement.kind === "receipt") return `/dashboard/expenses/${movement.referenceId}`;
    return null;
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <nav
        aria-label={t("breadcrumbLabel")}
        className="flex items-center gap-2 text-body-caption text-muted-foreground"
      >
        <Link href="/dashboard/inventory" className="hover:text-foreground">
          {t("heading")}
        </Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <span className="font-medium text-foreground">{t("movements.heading")}</span>
      </nav>
      <div>
        <h1 className="dashboard-page-title">{t("movements.heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("movements.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-body-caption text-muted-foreground">
          {t("col.item")}
          <ListFilterSelect
            className="h-9 min-w-48"
            paramName="item"
            label={t("col.item")}
            options={[
              { value: "", label: t("movements.allItems") },
              ...items.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
        </label>
        <label className="flex flex-col gap-1 text-body-caption text-muted-foreground">
          {t("movements.kindLabel")}
          <ListFilterSelect
            className="h-9 min-w-40"
            paramName="kind"
            label={t("movements.kindLabel")}
            options={[
              { value: "", label: t("movements.allKinds") },
              ...STOCK_MOVEMENT_KINDS.map((kind) => ({ value: kind, label: t(`kind.${kind}`) })),
            ]}
          />
        </label>
      </div>

      <section className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background">
        {page.items.length === 0 ? (
          <EmptyState icon={History} title={t("movements.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-body-small">
              <thead className="bg-surface text-body-caption text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("dateLabel")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("col.item")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("movements.kindLabel")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    {t("movements.quantity")}
                  </th>
                  {costsVisible ? (
                    <th scope="col" className="px-4 py-3 text-end font-medium">
                      {t("col.value")}
                    </th>
                  ) : null}
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("movements.by")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.items.map((movement) => {
                  const href = referenceHref(movement);
                  const unit = t(`unit.${units.get(movement.ingredientId) ?? "piece"}`);
                  return (
                    <tr key={movement.id}>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                        {formatCafeDayMedium(movement.date, locale)}
                      </td>
                      <td className="px-4 py-2.5 text-foreground" dir="auto">
                        {movement.ingredientName}
                      </td>
                      <td className="px-4 py-2.5">
                        {href ? (
                          <Link href={href} className="text-primary underline-offset-4 hover:underline">
                            {t(`kind.${movement.kind}`)}
                          </Link>
                        ) : (
                          t(`kind.${movement.kind}`)
                        )}
                        {movement.note ? (
                          <span className="block text-body-caption text-muted-foreground" dir="auto">
                            {movement.note}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-end whitespace-nowrap",
                          movement.quantity < 0 ? "text-error-foreground" : "text-success-foreground",
                        )}
                      >
                        {movement.quantity > 0 ? "+" : ""}
                        {formatNumber(movement.quantity, locale, 3)} {unit}
                      </td>
                      {costsVisible ? (
                        <td className="px-4 py-2.5 text-end whitespace-nowrap">
                          {formatMoney(movement.value, locale)}
                        </td>
                      ) : null}
                      <td className="px-4 py-2.5 text-muted-foreground">{movement.createdByName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border px-4 py-3">
          <ListPager page={page} />
        </div>
      </section>
    </div>
  );
}
