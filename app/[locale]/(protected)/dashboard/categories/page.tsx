import { parseAdminCategoryFilters } from "@/src/lib/api/admin-category-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { CategoriesScreen } from "@/src/presentation/dashboard/categories/CategoriesScreen";
import { CATEGORY_PAGE_SIZES } from "@/src/presentation/dashboard/categories/category-page-sizes";
import { categoriesServerApi } from "@/src/presentation/dashboard/categories/category-server-api";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";

// Categories are fetched during server render over the REST API (BFF) and passed to
// the presentational screen. Search and status filters live in the query string, so
// changing either re-runs this render; so does a mutation's router.refresh(). The
// server stays the single source of truth. A failed fetch surfaces via the
// dashboard error boundary (error.tsx). The admin gate lives in the layout.
export const dynamic = "force-dynamic";

type DashboardCategoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardCategoriesPageProps) {
  // The layout only gates on `dashboard.view`; this whole section is a write
  // surface, so anyone without the permission is redirected rather than shown a
  // page whose every read would 401.
  await requirePermission("catalog.write");

  const params = await withRememberedPageSize(toSearchParams(await searchParams), CATEGORY_PAGE_SIZES);
  const categories = await categoriesServerApi.listPage(params);
  return <CategoriesScreen categories={categories} filters={parseAdminCategoryFilters(params)} />;
}
