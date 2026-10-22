import { requirePermission } from "@/src/lib/require-permission";
import { CategoriesScreen } from "@/src/presentation/dashboard/categories/CategoriesScreen";
import { categoriesServerApi } from "@/src/presentation/dashboard/categories/category-server-api";

// Every category is fetched during server render over the REST API (BFF), in menu
// order, and passed to the presentational screen; a mutation's router.refresh()
// re-runs this render. The server stays the single source of truth. A failed
// fetch surfaces via the dashboard error boundary (error.tsx). The admin gate
// lives in the layout.
export const dynamic = "force-dynamic";

export default async function DashboardCategoriesPage() {
  // The layout only gates on `dashboard.view`; this whole section is a write
  // surface, so anyone without the permission is redirected rather than shown a
  // page whose every control would 401.
  await requirePermission("catalog.write");

  const categories = await categoriesServerApi.list();
  return <CategoriesScreen categories={categories} />;
}
