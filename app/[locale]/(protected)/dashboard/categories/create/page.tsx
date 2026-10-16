import { getTranslations } from "next-intl/server";

import { requirePermission } from "@/src/lib/require-permission";
import { CategoryForm } from "@/src/presentation/dashboard/categories/CategoryForm";

export default async function CreateCategoryPage() {
  // The layout only gates on `dashboard.view`; this whole section is a write
  // surface, so anyone without the permission is redirected rather than shown a
  // page whose every read would 401.
  await requirePermission("catalog.write");

  const t = await getTranslations("dashCategories");

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-heading-section text-foreground">{t("newCategory")}</h1>
        <p className="text-body-small text-muted-foreground">{t("createSubtitle")}</p>
      </div>
      <CategoryForm mode="create" />
    </div>
  );
}
