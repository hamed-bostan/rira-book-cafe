import { PackageX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

/** Shown when editing a product that no longer exists (the page called `notFound()`). */
export default async function EditProductNotFound() {
  const t = await getTranslations("dashProducts");

  return (
    <div className="max-w-xl rounded-card-lg border border-dashed border-border">
      <EmptyState
        size="page"
        icon={PackageX}
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/products">{t("backToProducts")}</Link>
          </Button>
        }
      />
    </div>
  );
}
