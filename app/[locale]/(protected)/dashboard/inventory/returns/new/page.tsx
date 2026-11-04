import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { suppliersServerApi } from "@/src/presentation/dashboard/expenses/expense-server-api";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { SupplierReturnForm } from "@/src/presentation/dashboard/inventory/SupplierReturnForm";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

export const dynamic = "force-dynamic";

type NewReturnPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** `?item=` (from an item's menu) or `?expense=` (from a delivery's page) starts the form on it. */
export default async function NewSupplierReturnPage({ searchParams }: NewReturnPageProps) {
  await requirePermission("inventory.manage");
  const params = toSearchParams(await searchParams);
  const [t, summary, suppliers, deliveries] = await Promise.all([
    getTranslations("dashInventory"),
    inventoryServerApi.getSummary(),
    suppliersServerApi.list(false),
    inventoryServerApi.listDeliveries(),
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("returns.new")} />
      <DashboardPageHeader
        backHref="/dashboard/inventory/returns"
        backLabel={t("returns.heading")}
        title={t("returns.new")}
        subtitle={t("returns.newSubtitle")}
      />
      <SupplierReturnForm
        items={summary.items.filter((item) => item.isActive && item.onHand > 0)}
        suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
        deliveries={deliveries}
        today={cafeDayOf(new Date())}
        initialItemId={params.get("item") ?? undefined}
        initialExpenseId={params.get("expense") ?? undefined}
      />
    </div>
  );
}
