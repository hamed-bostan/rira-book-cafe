export type Category = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string;
  isActive: boolean;
  /**
   * The category this one sits under on the menu, or `null` for a top-level one.
   * One level only: a category with a parent can't itself be a parent (see
   * {@link canNestUnder}), so the menu is parents and their subcategories, never deeper.
   */
  parentId: string | null;
  /** How many products currently reference this category. Derived, not stored. */
  productCount: number;
  /** How many of those are hidden from the menu (unpublished). Derived, not stored. */
  hiddenProductCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Which way a category moves on the menu: `up` shows it one place earlier,
 * `down` one place later. The dashboard's up/down buttons send these.
 */
export const CATEGORY_MOVE_DIRECTIONS = ["up", "down"] as const;
export type CategoryMoveDirection = (typeof CATEGORY_MOVE_DIRECTIONS)[number];

/** How many categories one drag-reorder may list — far above any real menu. */
export const MAX_REORDER_CATEGORIES = 200;

/**
 * Whether guests see a category: its own switch is on, and — for a subcategory —
 * its parent's is too. Hiding a parent hides everything under it, so a subcategory
 * whose parent can't be found reads as hidden rather than shown.
 */
export function isCategoryShown(
  category: Pick<Category, "isActive"> & { parentId?: string | null },
  parent: Pick<Category, "isActive"> | null | undefined,
): boolean {
  if (!category.isActive) return false;
  if (category.parentId == null) return true;
  return parent?.isActive === true;
}

/**
 * A category as the public-menu rule reads it: its own switch, and — for a
 * subcategory — its parent's, attached (see `categoryLookup`).
 */
export type MenuCategory = Pick<Category, "isActive"> & {
  parentId?: string | null;
  parent?: Pick<Category, "isActive"> | null;
};

/** The categories guests see, in the order given: shown ones whose parent (if any) is shown too. */
export function shownCategories<T extends Pick<Category, "id" | "isActive" | "parentId">>(
  categories: readonly T[],
): T[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return categories.filter((category) =>
    isCategoryShown(category, category.parentId ? byId.get(category.parentId) : null),
  );
}

/**
 * Why a category can't sit under a given parent, or `null` when it can. The
 * nesting is one level deep, so:
 * - a category can't be its own parent;
 * - the parent must be a top-level category (a subcategory holds no subcategories);
 * - a category that has subcategories of its own can't become one.
 * Those three rule out cycles too: with one level there's no path back up.
 */
export type CategoryNestingProblem = "self" | "parentIsSubcategory" | "hasSubcategories";

export function canNestUnder(
  categoryId: string | null,
  parent: Pick<Category, "id" | "parentId">,
  categories: readonly Pick<Category, "id" | "parentId">[],
): CategoryNestingProblem | null {
  if (categoryId !== null && parent.id === categoryId) return "self";
  if (parent.parentId !== null) return "parentIsSubcategory";
  if (categoryId !== null && categories.some((category) => category.parentId === categoryId)) {
    return "hasSubcategories";
  }
  return null;
}

/**
 * The menu's order: each top-level category in its place, followed straight away by
 * its subcategories in theirs. `categories` arrive sorted by their place among
 * their siblings; a subcategory whose parent is missing is kept, at the end.
 */
export function inMenuOrder<T extends Pick<Category, "id" | "parentId">>(categories: readonly T[]): T[] {
  const ids = new Set(categories.map((category) => category.id));
  const childrenOf = new Map<string, T[]>();
  for (const category of categories) {
    if (category.parentId === null || !ids.has(category.parentId)) continue;
    const siblings = childrenOf.get(category.parentId) ?? [];
    siblings.push(category);
    childrenOf.set(category.parentId, siblings);
  }
  const ordered: T[] = [];
  for (const category of categories) {
    if (category.parentId !== null) continue;
    ordered.push(category, ...(childrenOf.get(category.id) ?? []));
  }
  const placed = new Set(ordered.map((category) => category.id));
  return [...ordered, ...categories.filter((category) => !placed.has(category.id))];
}

/** A category and the ones it holds (direct children only — there's one level). */
export function categoryAndChildren(
  categoryId: string,
  categories: readonly Pick<Category, "id" | "parentId">[],
): Set<string> {
  return new Set([
    categoryId,
    ...categories.filter((category) => category.parentId === categoryId).map((category) => category.id),
  ]);
}
