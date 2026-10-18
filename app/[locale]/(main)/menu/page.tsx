import { getTranslations } from "next-intl/server";

import { PRODUCT_KINDS, type ProductKind } from "@/src/domain/entities/Product";
import { pageMetadata } from "@/src/presentation/seo/pageMetadata";
import { MenuScreen } from "@/src/presentation/storefront/menu/MenuScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

// Rendered per request (the CSP nonce needs it); the menu and its categories come
// over the REST API (BFF) from the data cache. Filters and the page live in the
// query string.
export const dynamic = "force-dynamic";

type MenuPageProps = {
  searchParams: Promise<{ category?: string; kind?: string; page?: string }>;
};

/**
 * A category filter is the category's own landing page (its name as the title,
 * `?category=` kept in the canonical URL); every other filter combination
 * canonicalizes to the plain menu. Later pages keep `?page=` in their canonical,
 * so the items on them stay indexable rather than folded into page 1.
 */
export async function generateMetadata({ searchParams }: MenuPageProps): Promise<Metadata> {
  const [{ category: categoryId, page }, t] = await Promise.all([searchParams, getTranslations("site")]);
  const pageNumber = Number.parseInt(page ?? "1", 10);
  const pageQuery = pageNumber > 1 ? `page=${pageNumber}` : "";
  const category = categoryId
    ? (await storefrontServerApi.categories()).find((candidate) => candidate.id === categoryId)
    : undefined;

  if (category) {
    return pageMetadata({
      title: category.name,
      description: t("menu.subtitle"),
      path: `/menu?category=${encodeURIComponent(category.id)}${pageQuery ? `&${pageQuery}` : ""}`,
    });
  }
  return pageMetadata({
    title: t("menu.heading"),
    description: t("menu.subtitle"),
    path: pageQuery ? `/menu?${pageQuery}` : "/menu",
  });
}

export default async function MenuPage({ searchParams }: MenuPageProps) {
  const { category, kind, page } = await searchParams;
  const [categories, items] = await Promise.all([storefrontServerApi.categories(), storefrontServerApi.menu()]);
  const validKind = (PRODUCT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as ProductKind) : undefined;

  const pageNumber = Number.parseInt(page ?? "1", 10);

  return (
    <MenuScreen
      categories={categories}
      items={items}
      categoryId={category}
      kind={validKind}
      page={Number.isFinite(pageNumber) ? pageNumber : 1}
    />
  );
}
