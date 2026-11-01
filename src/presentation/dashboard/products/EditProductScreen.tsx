import type { Category } from "@/src/domain/entities/Category";
import type { Product } from "@/src/domain/entities/Product";
import type { ProductTranslationInput } from "@/src/domain/repositories/IProductRepository";
import type { ActivityEntryWire } from "@/src/presentation/dashboard/activity/activity-response-schema";
import { ActivityPanel } from "@/src/presentation/dashboard/activity/ActivityPanel";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

import { ProductForm } from "./ProductForm";

/**
 * Edit screen. Presentational: the page fetches the product (and the category
 * list for the picker) over the REST API (BFF) during server render and passes
 * them in, then hands them to the shared `ProductForm`. A missing product is
 * handled upstream via `notFound()`.
 */
export function EditProductScreen({
  product,
  categories,
  translations,
  activity,
}: {
  product: Product;
  categories: Category[];
  translations: ProductTranslationInput[];
  /** The item's recent admin activity, for the form's narrow column. */
  activity: ActivityEntryWire[];
}) {
  return (
    <>
      <DashboardPageCrumb label={product.name} />
      <ProductForm
        mode="edit"
        product={product}
        categories={categories}
        translations={translations}
        activity={<ActivityPanel entries={activity} />}
      />
    </>
  );
}
