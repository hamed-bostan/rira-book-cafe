import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Supplier } from "@/src/domain/entities/Expense";
import { Link } from "@/src/i18n/navigation";
import { Badge } from "@/src/presentation/design-system";

import { SupplierDialog } from "./SupplierDialog";

/** Who the cafe buys from. Suppliers are switched off rather than deleted — old bills keep their name. */
export async function SuppliersScreen({ suppliers, canWrite }: { suppliers: Supplier[]; canWrite: boolean }) {
  const t = await getTranslations("dashExpenses");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <nav aria-label={t("breadcrumbLabel")} className="flex items-center gap-2 text-body-caption text-muted-foreground">
        <Link href="/dashboard/expenses" className="hover:text-foreground">
          {t("heading")}
        </Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <span className="font-medium text-foreground">{t("suppliers.heading")}</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="dashboard-page-title">{t("suppliers.heading")}</h1>
          <p className="mt-1 text-body-small text-muted-foreground">{t("suppliers.subtitle")}</p>
        </div>
        {canWrite ? <SupplierDialog /> : null}
      </div>

      <section className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background">
        {suppliers.length === 0 ? (
          <p className="px-6 py-16 text-center text-body-small-emphasis text-muted-foreground">{t("suppliers.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {suppliers.map((supplier) => (
              <li key={supplier.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/expenses?supplier=${supplier.id}`} className="text-body-small-emphasis text-foreground underline-offset-4 hover:underline">
                    {supplier.name}
                  </Link>
                  {supplier.phone || supplier.note ? (
                    <p className="truncate text-body-caption text-muted-foreground" dir="auto">
                      {[supplier.phone, supplier.note].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
                {!supplier.isActive ? (
                  <Badge size="sm" variant="neutral">
                    {t("suppliers.inactive")}
                  </Badge>
                ) : null}
                {canWrite ? <SupplierDialog supplier={supplier} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
