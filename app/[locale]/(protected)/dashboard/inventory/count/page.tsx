import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { StockCountForm } from "@/src/presentation/dashboard/inventory/StockCountForm";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

export const dynamic = "force-dynamic";

export default async function StockCountPage() {
  await requirePermission("inventory.manage");
  const [t, summary] = await Promise.all([getTranslations("dashInventory"), inventoryServerApi.getSummary()]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("count.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/inventory"
        backLabel={t("heading")}
        title={t("count.heading")}
        subtitle={t("count.subtitle")}
      />
      <StockCountForm
        items={summary.items.filter((item) => item.isActive)}
        today={cafeDayOf(new Date())}
        costsVisible={summary.costsVisible}
      />
    </div>
  );
}
