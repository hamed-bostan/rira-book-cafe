import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { DashboardEmptyState } from "@/src/presentation/dashboard/DashboardEmptyState";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { OpeningStockForm } from "@/src/presentation/dashboard/inventory/OpeningStockForm";
import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

export const dynamic = "force-dynamic";

export default async function OpeningStockPage() {
  await requirePermission("inventory.manage");
  const [t, summary] = await Promise.all([getTranslations("dashInventory"), inventoryServerApi.getSummary()]);
  // Opening stock is once per item, before anything has moved it; an item already
  // tracked takes a delivery or a count instead.
  const items = summary.items.filter((item) => item.isActive && !item.hasHistory);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("opening.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/inventory"
        backLabel={t("heading")}
        title={t("opening.heading")}
        subtitle={t("opening.subtitle")}
      />
      {items.length > 0 ? (
        <OpeningStockForm items={items} today={cafeDayOf(new Date())} />
      ) : (
        <div className={PAGE_CARD}>
          <DashboardEmptyState title={t("opening.noneTitle")} body={t("opening.noneBody")} />
        </div>
      )}
    </div>
  );
}
