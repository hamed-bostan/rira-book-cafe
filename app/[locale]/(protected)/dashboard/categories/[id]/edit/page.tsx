import { notFound } from "next/navigation";

import { DEFAULT_ACTIVITY_LIMIT } from "@/src/domain/entities/ActivityEntry";
import { requirePermission } from "@/src/lib/require-permission";
import { activityServerApi } from "@/src/presentation/dashboard/activity/activity-server-api";
import { categoriesServerApi } from "@/src/presentation/dashboard/categories/category-server-api";
import { EditCategoryScreen } from "@/src/presentation/dashboard/categories/EditCategoryScreen";

type EditCategoryPageProps = {
  params: Promise<{ id: string }>;
};

// The category is fetched over the REST API (BFF) during server render; a missing
// one renders the not-found boundary. The screen is presentational from there.
export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  // The layout only gates on `dashboard.view`; this whole section is a write
  // surface, so anyone without the permission is redirected rather than shown a
  // page whose every read would 401.
  await requirePermission("catalog.write");

  const { id } = await params;
  const [category, translations, activity, categories] = await Promise.all([
    categoriesServerApi.getById(id),
    categoriesServerApi.getTranslations(id),
    activityServerApi.listForEntity("category", id, DEFAULT_ACTIVITY_LIMIT),
    categoriesServerApi.list(),
  ]);
  if (!category) notFound();

  // It can sit under any other top-level category; one with subcategories stays put.
  const parents = categories
    .filter((candidate) => candidate.parentId === null && candidate.id !== id)
    .map(({ id: parentId, name }) => ({ id: parentId, name }));
  const hasSubcategories = categories.some((candidate) => candidate.parentId === id);

  return (
    <EditCategoryScreen
      category={category}
      translations={translations}
      parents={parents}
      hasSubcategories={hasSubcategories}
      activity={activity}
    />
  );
}
