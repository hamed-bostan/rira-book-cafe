import { getTranslations } from "next-intl/server";

import type { Category } from "@/src/domain/entities/Category";
import type { Product } from "@/src/domain/entities/Product";
import type { ProductTranslationInput } from "@/src/domain/repositories/IProductRepository";

import { ProductForm } from "./ProductForm";

/**
 * Edit screen. Presentational: the page fetches the product (and the category
 * list for the picker) over the REST API (BFF) during server render and passes
 * them in, then hands them to the shared `ProductForm`. A missing product is
 * handled upstream via `notFound()`.
 */
export async function EditProductScreen({
  product,
  categories,
  translations,
}: {
  product: Product;
  categories: Category[];
  translations: ProductTranslationInput[];
}) {
  const t = await getTranslations("dashProducts");

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("editHeading")}</h1>
        <p className="text-body-small text-muted-foreground">{t("editSubtitle", { name: product.name })}</p>
      </div>
      <ProductForm mode="edit" product={product} categories={categories} translations={translations} />
    </div>
  );
}
