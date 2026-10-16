import { notFound } from "next/navigation";

import { requirePermission } from "@/src/lib/require-permission";
import { categoriesServerApi } from "@/src/presentation/dashboard/categories/category-server-api";
import { EditProductScreen } from "@/src/presentation/dashboard/products/EditProductScreen";
import { productsServerApi } from "@/src/presentation/dashboard/products/product-server-api";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

// The product (and the category list for the picker) is fetched over the REST API
// (BFF) during server render; a missing product renders the not-found boundary.
// The screen is presentational from there.
export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: EditProductPageProps) {
  // The layout only gates on `dashboard.view`; this whole section is a write
  // surface, so anyone without the permission is redirected rather than shown a
  // page whose every read would 401.
  await requirePermission("catalog.write");

  const { id } = await params;
  const [product, categories, translations] = await Promise.all([
    productsServerApi.getById(id),
    categoriesServerApi.list(),
    productsServerApi.getTranslations(id),
  ]);
  if (!product) notFound();

  return (
    <EditProductScreen
      product={product}
      categories={categories}
      translations={translations}
    />
  );
}
