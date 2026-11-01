import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { suppliersServerApi } from "@/src/presentation/dashboard/expenses/expense-server-api";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { ReceiveStockForm } from "@/src/presentation/dashboard/inventory/ReceiveStockForm";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

export const dynamic = "force-dynamic";

export default async function ReceiveStockPage() {
  await requirePermission("inventory.manage");
  const [t, summary, suppliers] = await Promise.all([
    getTranslations("dashInventory"),
    inventoryServerApi.getSummary(),
    suppliersServerApi.list(false),
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("receive.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/inventory"
        backLabel={t("heading")}
        title={t("receive.heading")}
        subtitle={t("receive.subtitle")}
      />
      <ReceiveStockForm
        items={summary.items.filter((item) => item.isActive)}
        suppliers={suppliers}
        today={cafeDayOf(new Date())}
      />
    </div>
  );
}
