import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { OpeningStockForm } from "@/src/presentation/dashboard/inventory/OpeningStockForm";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

export const dynamic = "force-dynamic";

export default async function OpeningStockPage() {
  await requirePermission("inventory.manage");
  const [t, summary] = await Promise.all([getTranslations("dashInventory"), inventoryServerApi.getSummary()]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("opening.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/inventory"
        backLabel={t("heading")}
        title={t("opening.heading")}
        subtitle={t("opening.subtitle")}
      />
      <OpeningStockForm items={summary.items.filter((item) => item.isActive)} today={cafeDayOf(new Date())} />
    </div>
  );
}
