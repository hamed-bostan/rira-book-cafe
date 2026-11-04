import { canNestUnder, type Category } from "../../entities/Category";
import { ConflictError } from "../../errors/ConflictError";
import { ValidationError } from "../../errors/ValidationError";

/**
 * Check a requested parent against the one-level nesting rule and return it.
 * `undefined` (not asked to change) and `null` (top level) pass straight through;
 * an id must name an existing top-level category other than this one, and a
 * category that has subcategories can't itself be filed under another.
 *
 * `categoryId` is the category being saved, or `null` for one being created.
 */
export function requireValidParent(
  categoryId: string | null,
  parentId: string | null | undefined,
  categories: readonly Category[],
): Category | null | undefined {
  if (parentId === undefined || parentId === null) return parentId;

  const parent = categories.find((category) => category.id === parentId);
  if (!parent) throw new ValidationError("parentId", "That parent category doesn't exist.");

  switch (canNestUnder(categoryId, parent, categories)) {
    case "self":
      throw new ValidationError("parentId", "A category can't sit under itself.");
    case "parentIsSubcategory":
      throw new ConflictError(
        "PARENT_IS_SUBCATEGORY",
        `${parent.name} is itself a subcategory. Choose a top-level category as the parent.`,
        { fields: ["parentId"] },
      );
    case "hasSubcategories":
      throw new ConflictError(
        "HAS_SUBCATEGORIES",
        "This category has subcategories of its own, so it can't sit under another one.",
        { fields: ["parentId"] },
      );
    case null:
      return parent;
  }
}

/** A category's parent's name, for the activity log — `null` for a top-level one. */
export function parentNameOf(
  category: Pick<Category, "parentId">,
  categories: readonly Pick<Category, "id" | "name">[],
): string | null {
  if (!category.parentId) return null;
  return categories.find((candidate) => candidate.id === category.parentId)?.name ?? null;
}
