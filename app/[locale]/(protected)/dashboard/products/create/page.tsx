import { getTranslations } from "next-intl/server";

import { requirePermission } from "@/src/lib/require-permission";
import { categoriesServerApi } from "@/src/presentation/dashboard/categories/category-server-api";
import { ProductForm } from "@/src/presentation/dashboard/products/ProductForm";

// The category list for the picker is fetched over the REST API (BFF) during
// server render. A failed fetch surfaces via the dashboard error boundary.
export const dynamic = "force-dynamic";

export default async function CreateProductPage() {
  // The layout only gates on `dashboard.view`; this whole section is a write
  // surface, so anyone without the permission is redirected rather than shown a
  // page whose every read would 401.
  await requirePermission("catalog.write");

  const [categories, t] = await Promise.all([categoriesServerApi.list(), getTranslations("dashProducts")]);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-heading-section text-foreground">{t("newProduct")}</h1>
        <p className="text-body-small text-muted-foreground">{t("createSubtitle")}</p>
      </div>
      <ProductForm mode="create" categories={categories} />
    </div>
  );
}
