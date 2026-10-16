import { getTranslations } from "next-intl/server";

import type { Category } from "@/src/domain/entities/Category";
import type { CategoryTranslationInput } from "@/src/domain/repositories/ICategoryRepository";
import type { ActivityEntryWire } from "@/src/presentation/dashboard/activity/activity-response-schema";
import { ActivityPanel } from "@/src/presentation/dashboard/activity/ActivityPanel";

import { CategoryForm } from "./CategoryForm";

/**
 * Edit screen. Presentational: the page fetches the category over the REST API
 * (BFF) during server render and passes it in, then hands it to the shared
 * `CategoryForm`. A missing category is handled upstream via `notFound()`.
 */
export async function EditCategoryScreen({
  category,
  translations,
  activity,
}: {
  category: Category;
  translations: CategoryTranslationInput[];
  /** The category's recent admin activity, for the panel under the form. */
  activity: ActivityEntryWire[];
}) {
  const t = await getTranslations("dashCategories");

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("editHeading")}</h1>
        <p className="text-body-small text-muted-foreground">{t("editSubtitle", { name: category.name })}</p>
      </div>
      <CategoryForm mode="edit" category={category} translations={translations} />
      <ActivityPanel entries={activity} />
    </div>
  );
}
