import { isOnPublicMenu, type Product } from "../../entities/Product";

import type { Category, MenuCategory } from "../../entities/Category";
import type { ICategoryRepository } from "../../repositories/ICategoryRepository";
import type { IProductRepository } from "../../repositories/IProductRepository";

/** What the public-menu rule reads about categories: whether each one is shown. */
export type MenuCategories = Pick<ICategoryRepository, "getAll">;

/**
 * The menu as ordering reads it: the items by id (in any state — the rule is
 * applied here, not by the read), and the categories that say whether they're shown.
 */
export type MenuCatalog = {
  products: Pick<IProductRepository, "getByIds">;
  categories: MenuCategories;
};

/**
 * Look a category up by id — every category, shown or hidden — with its parent
 * attached, so the public-menu rule can tell a subcategory of a hidden parent.
 */
export async function categoryLookup(
  categories: MenuCategories,
): Promise<(categoryId: string) => (Category & MenuCategory) | undefined> {
  const all = await categories.getAll();
  const byId = new Map(all.map((category) => [category.id, category]));
  const withParent = new Map(
    all.map((category) => [
      category.id,
      { ...category, parent: category.parentId ? (byId.get(category.parentId) ?? null) : null },
    ]),
  );
  return (categoryId) => withParent.get(categoryId);
}

/**
 * The items guests may see, in the order given — the ones {@link isOnPublicMenu}
 * keeps. The repository's public reads already leave unpublished items out; this
 * adds the category's switch, and is the one place that does.
 */
export async function keepOnPublicMenu<T extends Pick<Product, "isPublished" | "categoryId">>(
  categories: MenuCategories,
  products: readonly T[],
): Promise<T[]> {
  if (products.length === 0) return [];
  const categoryOf = await categoryLookup(categories);
  return products.filter((product) => isOnPublicMenu(product, categoryOf(product.categoryId)));
}
