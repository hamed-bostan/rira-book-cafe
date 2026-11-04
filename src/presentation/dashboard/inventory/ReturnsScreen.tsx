import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { StockItem, SupplierReturn } from "@/src/domain/entities/Inventory";
import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardPageHeader } from "../DashboardPageHeader";
import { PAGE_CARD } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { SupplierReturnCard } from "./SupplierReturnCard";

type ReturnsScreenProps = {
  returns: SupplierReturn[];
  items: StockItem[];
  costsVisible: boolean;
  canManage: boolean;
};

/** Stock sent back to suppliers, newest first, each with what went back and how its credit was settled. */
export async function ReturnsScreen({ returns, items, costsVisible, canManage }: ReturnsScreenProps) {
  const t = await getTranslations("dashInventory");
  const units = new Map(items.map((item) => [item.id, item.unit]));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("returns.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/inventory"
        backLabel={t("heading")}
        title={t("returns.heading")}
        subtitle={t("returns.subtitle")}
        actions={
          canManage ? (
            <Button asChild size="control-md" className="gap-2 px-4">
              <Link href="/dashboard/inventory/returns/new">
                <Icon icon={Plus} size="icon-md" />
                {t("returns.new")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {returns.length === 0 ? (
        <section className={PAGE_CARD}>
          <DashboardEmptyState title={t("returns.emptyTitle")} body={t("returns.emptyBody")} />
        </section>
      ) : (
        <div className="flex flex-col gap-3">
          {returns.map((item) => (
            <SupplierReturnCard
              key={item.id}
              item={item}
              units={units}
              costsVisible={costsVisible}
              linkDelivery={costsVisible}
            />
          ))}
        </div>
      )}
    </div>
  );
}
