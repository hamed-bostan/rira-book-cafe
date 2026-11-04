import type { Category } from "@/src/domain/entities/Category";
import type { CategoryTranslationInput } from "@/src/domain/repositories/ICategoryRepository";
import type { ActivityEntryWire } from "@/src/presentation/dashboard/activity/activity-response-schema";
import { ActivityPanel } from "@/src/presentation/dashboard/activity/ActivityPanel";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

import { CategoryForm, type ParentOption } from "./CategoryForm";

/**
 * Edit screen. Presentational: the page fetches the category over the REST API
 * (BFF) during server render and passes it in, then hands it to the shared
 * `CategoryForm`. A missing category is handled upstream via `notFound()`.
 */
export function EditCategoryScreen({
  category,
  translations,
  parents,
  hasSubcategories,
  activity,
}: {
  category: Category;
  translations: CategoryTranslationInput[];
  /** The top-level categories it can be filed under. */
  parents: ParentOption[];
  hasSubcategories: boolean;
  /** The category's recent admin activity, for the form's narrow column. */
  activity: ActivityEntryWire[];
}) {
  return (
    <>
      <DashboardPageCrumb label={category.name} />
      <CategoryForm
        mode="edit"
        category={category}
        translations={translations}
        parents={parents}
        hasSubcategories={hasSubcategories}
        activity={<ActivityPanel entries={activity} />}
      />
    </>
  );
}
