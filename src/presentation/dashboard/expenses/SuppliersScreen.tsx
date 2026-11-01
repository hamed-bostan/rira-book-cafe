import { getTranslations } from "next-intl/server";

import type { Supplier } from "@/src/domain/entities/Expense";
import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardPageHeader } from "../DashboardPageHeader";
import { PAGE_CARD, ROW_CAPTION, ROW_TEXT } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { SupplierDialog } from "./SupplierDialog";

/** Who the cafe buys from. Suppliers are switched off rather than deleted — old bills keep their name. */
export async function SuppliersScreen({ suppliers, canWrite }: { suppliers: Supplier[]; canWrite: boolean }) {
  const t = await getTranslations("dashExpenses");

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
            {suppliers.map((supplier) => (
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
                {canWrite ? <SupplierDialog supplier={supplier} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
