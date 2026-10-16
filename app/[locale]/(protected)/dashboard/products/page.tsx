import { auth } from "@/auth";
import { parseAdminProductFilters } from "@/src/lib/api/admin-product-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { categoriesServerApi } from "@/src/presentation/dashboard/categories/category-server-api";
import { productsServerApi } from "@/src/presentation/dashboard/products/product-server-api";
import { ProductsScreen } from "@/src/presentation/dashboard/products/ProductsScreen";

// One page of products is fetched during server render over the REST API (BFF)
// and passed to the presentational screen. Search, filters, sorting and paging
// live in the query string, so changing any of them re-runs this render; so does
// a mutation's router.refresh(). The server stays the single source of truth. A
// failed fetch surfaces via the dashboard error boundary (error.tsx). The admin
// gate lives in the layout.
export const dynamic = "force-dynamic";

type DashboardProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardProductsPage({ searchParams }: DashboardProductsPageProps) {
  const params = toSearchParams(await searchParams);

  // The query string is forwarded to the API as-is; the screen gets the parsed
  // filters back only to tell "no products yet" from "nothing matched".
  // The list itself is a read anyone in the dashboard needs — support answers
  // "do we still sell this?" from it. Whether the *controls* are drawn is the
  // catalog permission, resolved here and passed down.
  const [products, categories, canWrite] = await Promise.all([
    productsServerApi.listPage(params),
    categoriesServerApi.list(),
    auth().then((session) => sessionHas(session, "catalog.write")),
  ]);

  return (
    <ProductsScreen
      products={products}
      categories={categories}
      filters={parseAdminProductFilters(params)}
      canWrite={canWrite}
    />
  );
}
