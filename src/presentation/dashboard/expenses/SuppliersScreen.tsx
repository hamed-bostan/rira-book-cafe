import { getLocale, getTranslations } from "next-intl/server";

import type { Supplier, SupplierBalances } from "@/src/domain/entities/Expense";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardPageHeader } from "../DashboardPageHeader";
import { AMOUNT, PAGE_CARD, ROW_CAPTION, ROW_TEXT } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { SupplierDialog } from "./SupplierDialog";

type SuppliersScreenProps = { suppliers: Supplier[]; balances: SupplierBalances; canWrite: boolean };

/**
 * Who the cafe buys from and what's left to pay each of them, part payments taken
 * off. Suppliers are switched off rather than deleted — old bills keep their name.
 */
export async function SuppliersScreen({ suppliers, balances, canWrite }: SuppliersScreenProps) {
  const t = await getTranslations("dashExpenses");
  const locale = await getLocale();
  const balanceOf = new Map(balances.suppliers.map((balance) => [balance.supplierId, balance]));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("suppliers.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/expenses"
        backLabel={t("heading")}
        title={t("suppliers.heading")}
        subtitle={t("suppliers.subtitle")}
        actions={canWrite ? <SupplierDialog /> : undefined}
      />

      <section aria-label={t("suppliers.heading")} className={cn(PAGE_CARD, ROW_TEXT, "overflow-hidden")}>
        {suppliers.length === 0 ? (
          <p className="px-5 py-12 text-center font-semibold text-foreground">{t("suppliers.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {suppliers.map((supplier) => {
              const balance = balanceOf.get(supplier.id);
              return (
                <li key={supplier.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/expenses?supplier=${supplier.id}`}
                        className={cn(
                          "font-semibold transition-colors hover:text-primary",
                          supplier.isActive ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {supplier.name}
                      </Link>
                      {!supplier.isActive ? (
                        <Badge size="compact" variant="neutral" appearance="outline">
                          {t("suppliers.inactive")}
                        </Badge>
                      ) : null}
                    </span>
                    {supplier.note ? (
                      <span className={ROW_CAPTION} dir="auto">
                        {supplier.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="whitespace-nowrap text-foreground/80 tabular-nums" dir="ltr">
                    {supplier.phone || "—"}
                  </span>
                  <span className="flex min-w-32 flex-col items-end gap-0.5">
                    {balance ? (
                      <>
                        <Link
                          href={`/dashboard/expenses?supplier=${supplier.id}&status=unpaid`}
                          aria-label={t("suppliers.owedLink", {
                            name: supplier.name,
                            amount: formatMoney(balance.owed, locale),
                          })}
                          className={cn(
                            AMOUNT,
                            "-my-3 py-3 font-semibold text-foreground transition-colors hover:text-primary sm:my-0 sm:py-0",
                          )}
                        >
                          {formatMoney(balance.owed, locale)}
                        </Link>
                        <span className={ROW_CAPTION}>{t("suppliers.unpaidBills", { count: balance.billCount })}</span>
                      </>
                    ) : (
                      <span className={ROW_CAPTION}>{t("owedNone")}</span>
                    )}
                  </span>
                  {canWrite ? <SupplierDialog supplier={supplier} /> : null}
                </li>
              );
            })}
          </ul>
        )}
        {balances.total > 0 ? (
          <dl className="flex flex-col gap-1 border-t border-border bg-muted px-5 py-3">
            {balances.noSupplier.owed > 0 ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className={ROW_CAPTION}>
                  {t("suppliers.noSupplierBills", { count: balances.noSupplier.billCount })}
                </dt>
                <dd className={cn(AMOUNT, ROW_CAPTION)}>{formatMoney(balances.noSupplier.owed, locale)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4 font-semibold text-foreground">
              <dt>{t("suppliers.totalOwed")}</dt>
              <dd className={AMOUNT}>{formatMoney(balances.total, locale)}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </div>
  );
}
