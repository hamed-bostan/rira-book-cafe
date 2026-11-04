import { getTranslations } from "next-intl/server";

import { cafeDayOf, isCafeDay } from "@/src/domain/entities/CafeTime";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { StockCountForm } from "@/src/presentation/dashboard/inventory/StockCountForm";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

export const dynamic = "force-dynamic";

type StockCountPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * `?date=` is the count's day. A past one is compared with what each item had on
 * hand at the end of that day, read here over the API, not with today's figures.
 */
export default async function StockCountPage({ searchParams }: StockCountPageProps) {
  await requirePermission("inventory.manage");
  const today = cafeDayOf(new Date());
  const asked = toSearchParams(await searchParams).get("date") ?? "";
  const date = isCafeDay(asked) && asked < today ? asked : today;
  const [t, summary, onHandThen] = await Promise.all([
    getTranslations("dashInventory"),
    inventoryServerApi.getSummary(),
    date < today ? inventoryServerApi.getOnHandAt(date) : Promise.resolve(null),
  ]);

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
        today={today}
        date={date}
        expected={onHandThen ? Object.fromEntries(onHandThen) : undefined}
        costsVisible={summary.costsVisible}
      />
    </div>
  );
}
