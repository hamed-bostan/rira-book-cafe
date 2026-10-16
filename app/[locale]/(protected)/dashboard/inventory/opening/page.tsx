import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { OpeningStockForm } from "@/src/presentation/dashboard/inventory/OpeningStockForm";

export const dynamic = "force-dynamic";

export default async function OpeningStockPage() {
  await requirePermission("inventory.manage");
  const [t, summary] = await Promise.all([getTranslations("dashInventory"), inventoryServerApi.getSummary()]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("opening.heading")}</h1>
        <p className="text-body-small text-muted-foreground">{t("opening.subtitle")}</p>
      </div>
      <OpeningStockForm items={summary.items.filter((item) => item.isActive)} today={cafeDayOf(new Date())} />
    </div>
  );
}
