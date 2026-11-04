import { getLocale, getTranslations } from "next-intl/server";

import type { SupplierReturn } from "@/src/domain/entities/Inventory";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";

import { PAGE_CARD, ROW_CAPTION, ROW_TEXT } from "../pageStyles";

import { formatStockQuantity } from "./stockFormat";

type SupplierReturnCardProps = {
  item: SupplierReturn;
  /** Item units by id, to read each quantity with its unit. */
  units: ReadonlyMap<string, "g" | "ml" | "piece">;
  /** Credits and values, for those who see costs. */
  costsVisible: boolean;
  /** Links to the delivery's bill, for those who read the books. */
  linkDelivery: boolean;
};

/**
 * One return to a supplier: its number, day and supplier, the delivery it was made
 * against, what went back, and — to those who see costs — the credit and how it
 * was settled (off the bill, back as money) beside what the goods were carried at.
 */
export async function SupplierReturnCard({ item, units, costsVisible, linkDelivery }: SupplierReturnCardProps) {
  const t = await getTranslations("dashInventory");
  const locale = await getLocale();

  return (
    <article id={`return-${item.id}`} aria-label={`SR-${item.number}`} className={cn(PAGE_CARD, "scroll-mt-24 p-5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-body-strong text-foreground sm:text-body-small-strong">
          {t("returns.title", { number: item.number, supplier: item.supplierName })}
        </h2>
        <span className={ROW_CAPTION}>{formatCafeDayMedium(item.date, locale)}</span>
      </div>
      {item.expenseId && item.expenseNumber ? (
        <p className={cn(ROW_CAPTION, "mt-1")}>
          {linkDelivery ? (
            <Link
              href={`/dashboard/expenses/${item.expenseId}`}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
            >
              {t("returns.against", { number: item.expenseNumber })}
            </Link>
          ) : (
            t("returns.against", { number: item.expenseNumber })
          )}
        </p>
      ) : null}
      <ul className={cn(ROW_TEXT, "mt-3 flex flex-col gap-1")}>
        {item.lines.map((line) => (
          <li key={line.ingredientId} className="flex flex-wrap justify-between gap-x-4">
            <span dir="auto" className="text-foreground">
              {line.ingredientName}
            </span>
            <span className="text-foreground/80 tabular-nums">
              {t("quick.quantity", {
                quantity: formatStockQuantity(line.quantity, locale),
                unit: t(`unit.${units.get(line.ingredientId) ?? "piece"}`),
              })}
              {costsVisible ? ` · ${formatMoney(line.value, locale)}` : null}
            </span>
          </li>
        ))}
      </ul>
      {costsVisible ? (
        <dl className={cn(ROW_CAPTION, "mt-3 flex flex-wrap gap-x-6 gap-y-1")}>
          <div className="flex gap-1">
            <dt>{t("returns.credit")}</dt>
            <dd className="font-medium text-foreground tabular-nums">{formatMoney(item.creditAmount, locale)}</dd>
          </div>
          {item.appliedAmount > 0 ? (
            <div className="flex gap-1">
              <dt>{t("returns.applied")}</dt>
              <dd className="font-medium text-foreground tabular-nums">{formatMoney(item.appliedAmount, locale)}</dd>
            </div>
          ) : null}
          {item.refundedAmount > 0 && item.refundedTo ? (
            <div className="flex gap-1">
              <dt>{t(`returns.refundedTo.${item.refundedTo}`)}</dt>
              <dd className="font-medium text-foreground tabular-nums">{formatMoney(item.refundedAmount, locale)}</dd>
            </div>
          ) : null}
          <div className="flex gap-1">
            <dt>{t("returns.stockValue")}</dt>
            <dd className="font-medium text-foreground tabular-nums">{formatMoney(item.stockValue, locale)}</dd>
          </div>
        </dl>
      ) : null}
      {item.note ? (
        <p className={cn(ROW_CAPTION, "mt-2")} dir="auto">
          {item.note}
        </p>
      ) : null}
    </article>
  );
}
