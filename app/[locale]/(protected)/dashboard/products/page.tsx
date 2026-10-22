import { auth } from "@/auth";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { categoriesServerApi } from "@/src/presentation/dashboard/categories/category-server-api";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";
import { menuItemListParams, parseMenuItemShow } from "@/src/presentation/dashboard/products/menu-item-show";
import { productsServerApi } from "@/src/presentation/dashboard/products/product-server-api";
import { ProductsScreen } from "@/src/presentation/dashboard/products/ProductsScreen";

// One page of menu items is fetched during server render over the REST API (BFF)
// and passed to the presentational screen. The category tab, search, "Show"
// filter and paging live in the query string, so changing any of them re-runs
// this render; so does a mutation's router.refresh(). The server stays the single
// source of truth. A failed fetch surfaces via the dashboard error boundary
// (error.tsx). The admin gate lives in the layout.
export const dynamic = "force-dynamic";

type DashboardProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardProductsPage({ searchParams }: DashboardProductsPageProps) {
  const params = await withRememberedPageSize(toSearchParams(await searchParams));
  const categoryId = params.get("categoryId")?.trim() || undefined;
  const query = params.get("q")?.trim() || undefined;

  // The list itself is a read anyone in the dashboard needs — support answers
  // "do we still sell this?" from it. Whether the *controls* are drawn is the
  // catalog permission, resolved here and passed down. The attention count is
  // the whole menu's, whatever tab is open: it's the link that gets you there.
  const [products, categories, attention, canWrite] = await Promise.all([
    productsServerApi.listPage(menuItemListParams(params)),
    categoriesServerApi.list(),
    productsServerApi
      .listPage(new URLSearchParams({ stock: "needsRestock", pageSize: "1" }))
      .then((page) => page.total),
    auth().then((session) => sessionHas(session, "catalog.write")),
  ]);

  return (
    <ProductsScreen
      products={products}
      categories={categories}
      categoryId={categoryId}
      show={parseMenuItemShow(params.get("show"))}
      query={query}
      attention={attention}
      canWrite={canWrite}
    />
  );
}
