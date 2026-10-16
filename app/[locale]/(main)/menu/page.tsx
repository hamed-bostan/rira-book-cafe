import { PRODUCT_KINDS, type ProductKind } from "@/src/domain/entities/Product";
import { MenuScreen } from "@/src/presentation/storefront/menu/MenuScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

// The menu and its categories are read over the REST API (BFF) per request; the
// type and category filters live in the query string.
export const dynamic = "force-dynamic";

type MenuPageProps = {
  searchParams: Promise<{ category?: string; kind?: string }>;
};

export default async function MenuPage({ searchParams }: MenuPageProps) {
  const { category, kind } = await searchParams;
  const [categories, items] = await Promise.all([storefrontServerApi.categories(), storefrontServerApi.menu()]);
  const validKind = (PRODUCT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as ProductKind) : undefined;

  return <MenuScreen categories={categories} items={items} categoryId={category} kind={validKind} />;
}
