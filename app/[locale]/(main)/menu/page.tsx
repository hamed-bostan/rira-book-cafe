import { getTranslations } from "next-intl/server";

import { PRODUCT_KINDS, type ProductKind } from "@/src/domain/entities/Product";
import { pageMetadata } from "@/src/presentation/seo/pageMetadata";
import { MenuScreen } from "@/src/presentation/storefront/menu/MenuScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

// The menu and its categories are read over the REST API (BFF) per request; the
// type and category filters live in the query string.
export const dynamic = "force-dynamic";

type MenuPageProps = {
  searchParams: Promise<{ category?: string; kind?: string }>;
};

/**
 * A category filter is the category's own landing page (its name as the title,
 * `?category=` kept in the canonical URL); every other filter combination
 * canonicalizes to the plain menu.
 */
export async function generateMetadata({ searchParams }: MenuPageProps): Promise<Metadata> {
  const [{ category: categoryId }, t] = await Promise.all([searchParams, getTranslations("site")]);
  const category = categoryId
    ? (await storefrontServerApi.categories()).find((candidate) => candidate.id === categoryId)
    : undefined;

  if (category) {
    return pageMetadata({
      title: category.name,
      description: t("menu.subtitle"),
      path: `/menu?category=${encodeURIComponent(category.id)}`,
    });
  }
  return pageMetadata({ title: t("menu.heading"), description: t("menu.subtitle"), path: "/menu" });
}

export default async function MenuPage({ searchParams }: MenuPageProps) {
  const { category, kind } = await searchParams;
  const [categories, items] = await Promise.all([storefrontServerApi.categories(), storefrontServerApi.menu()]);
  const validKind = (PRODUCT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as ProductKind) : undefined;

  return <MenuScreen categories={categories} items={items} categoryId={category} kind={validKind} />;
}
