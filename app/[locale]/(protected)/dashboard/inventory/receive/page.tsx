import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { suppliersServerApi } from "@/src/presentation/dashboard/expenses/expense-server-api";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { ReceiveStockForm } from "@/src/presentation/dashboard/inventory/ReceiveStockForm";

export const dynamic = "force-dynamic";

export default async function ReceiveStockPage() {
  await requirePermission("inventory.manage");
  const [t, summary, suppliers] = await Promise.all([
    getTranslations("dashInventory"),
    inventoryServerApi.getSummary(),
    suppliersServerApi.list(false),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("receive.heading")}</h1>
        <p className="text-body-small text-muted-foreground">{t("receive.subtitle")}</p>
      </div>
      <ReceiveStockForm
        items={summary.items.filter((item) => item.isActive)}
        suppliers={suppliers}
        today={cafeDayOf(new Date())}
      />
    </div>
  );
}
