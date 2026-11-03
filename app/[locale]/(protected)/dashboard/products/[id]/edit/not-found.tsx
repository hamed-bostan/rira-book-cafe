import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { DashboardEmptyState } from "@/src/presentation/dashboard/DashboardEmptyState";
import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";

/**
 * Shown when editing a product that no longer exists (the page called `notFound()`):
 * the redesigned list's empty state, with the way back to the menu.
 */
export default async function EditProductNotFound() {
  const t = await getTranslations("dashProducts");

  return (
    <div className={cn(PAGE_CARD, "max-w-xl")}>
      <DashboardEmptyState
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        action={
          <Button asChild variant="secondary" size="control-md" className="px-3">
            <Link href="/dashboard/products">{t("backToProducts")}</Link>
          </Button>
        }
      />
    </div>
  );
}
