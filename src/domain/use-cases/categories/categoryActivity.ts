import type { Category } from "../../entities/Category";
import type { NewCategory } from "../../repositories/ICategoryRepository";

/**
 * The fields of a category the activity log tracks, flattened for diffing.
 *
 * The slug earns its place despite looking cosmetic: it's in every category URL,
 * so changing one silently breaks inbound links and anything bookmarked. "Who
 * renamed this slug and what was it" is the question that follows.
 *
 * `translations` is omitted. It's a nested per-locale structure, and rendering it
 * into a one-line before/after would produce a diff nobody can read — the entry
 * still records that the category was edited, and by whom.
 *
 * `isActive` is read with `?? true` on both sides of a diff: a `NewCategory`
 * that doesn't set it (the bulk activate/deactivate path writes the column
 * directly, bypassing this snapshot) means "leave it active", not "unset", so
 * it must never render as a change on its own.
 *
 * `parent` is the parent category's *name* (or nothing for a top-level one), not
 * its id: the entry should read "Parent: Coffee → Tea" years later, whatever
 * happened to either since. The caller looks the name up — it already has the list.
 */
export function categorySnapshot(
  category: Category | NewCategory,
  parentName: string | null = null,
): Record<string, unknown> {
  return {
    name: category.name,
    slug: category.slug,
    iconUrl: category.iconUrl,
    isActive: category.isActive ?? true,
    parent: parentName,
  };
}

/**
 * The field a reorder records: the category's place among its siblings, counted
 * from one as the dashboard shows it. Not `position` — the log already labels that
 * field as a person's job title (payroll), and the two must read differently.
 */
export const MENU_POSITION_FIELD = "menuPosition";
