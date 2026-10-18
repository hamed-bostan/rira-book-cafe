import { FolderX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

/** Shown when editing a category that no longer exists (the page called `notFound()`). */
export default async function EditCategoryNotFound() {
  const t = await getTranslations("dashCategories");

  return (
    <div className="max-w-xl rounded-card-lg border border-dashed border-border">
      <EmptyState
        size="page"
        icon={FolderX}
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/categories">{t("backToCategories")}</Link>
          </Button>
        }
      />
    </div>
  );
}
