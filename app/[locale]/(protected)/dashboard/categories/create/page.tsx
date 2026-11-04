import { getTranslations } from "next-intl/server";

import { requirePermission } from "@/src/lib/require-permission";
import { categoriesServerApi } from "@/src/presentation/dashboard/categories/category-server-api";
import { CategoryForm } from "@/src/presentation/dashboard/categories/CategoryForm";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

export default async function CreateCategoryPage() {
  // The layout only gates on `dashboard.view`; this whole section is a write
  // surface, so anyone without the permission is redirected rather than shown a
  // page whose every read would 401.
  await requirePermission("catalog.write");

  const [t, categories] = await Promise.all([getTranslations("dashCategories"), categoriesServerApi.list()]);
  // A new category can sit under any top-level one.
  const parents = categories.filter((category) => category.parentId === null).map(({ id, name }) => ({ id, name }));

  return (
    <>
      <DashboardPageCrumb label={t("newCategory")} />
      <CategoryForm mode="create" parents={parents} />
    </>
  );
}
