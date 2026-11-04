import { singleChange } from "../../entities/ActivityEntry";
import { MAX_REORDER_CATEGORIES } from "../../entities/Category";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { MENU_POSITION_FIELD } from "./categoryActivity";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { ICategoryRepository } from "../../repositories/ICategoryRepository";

/**
 * Put one parent's categories in a new order in one go — what a drag in the
 * dashboard's list sends when it's dropped. `parentId` `null` reorders the
 * top-level categories; an id reorders that parent's subcategories. Every listed
 * id must be one of those siblings: a reorder never moves a category to another
 * parent (that's the edit form's parent field). A sibling the list leaves out —
 * one added since the page was drawn — keeps its place after the listed ones.
 *
 * The log gets one entry per category the drag actually moved, not one per
 * category whose number shifted: dragging Tea above Coffee is "Tea: 3 → 1", not
 * also "Coffee: 1 → 2" and "Juice: 2 → 3". The moved ones are those outside the
 * longest run that kept its relative order (see {@link movedIds}).
 */
export class ReorderCategories {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  /** Returns how many categories moved — zero when the order was already this one. */
  async execute(parentId: string | null, ids: readonly string[], actor: ActivityActor): Promise<number> {
    if (ids.length === 0) throw new ValidationError("ids", "List the categories in their new order.");
    if (ids.length > MAX_REORDER_CATEGORIES) {
      throw new ValidationError("ids", `List at most ${MAX_REORDER_CATEGORIES} categories.`);
    }
    if (new Set(ids).size !== ids.length) throw new ValidationError("ids", "A category is listed twice.");

    const categories = await this.categoryRepo.getAll();
    if (parentId !== null && !categories.some((category) => category.id === parentId)) {
      throw new NotFoundError("category", parentId);
    }
    const siblings = categories.filter((category) => category.parentId === parentId);
    const siblingIds = new Set(siblings.map((category) => category.id));
    if (ids.some((id) => !siblingIds.has(id))) {
      throw new ValidationError("ids", "Only categories under the same parent can be reordered together.");
    }

    // The order the repository will write: the listed ones, then any left out.
    const before = siblings.map((category) => category.id);
    const listed = new Set(ids);
    const after = [...ids, ...before.filter((id) => !listed.has(id))];
    const moved = movedIds(before, after);
    if (moved.length === 0) return 0;

    const byId = new Map(siblings.map((category) => [category.id, category]));
    await this.categoryRepo.setOrder(
      parentId,
      after,
      moved.map((id) => () => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "category.updated",
        entityType: "category",
        entityId: id,
        entityLabel: byId.get(id)?.name,
        changes: singleChange(MENU_POSITION_FIELD, before.indexOf(id) + 1, after.indexOf(id) + 1),
      })),
    );
    return moved.length;
  }
}

/**
 * The ids a reorder really moved: everything outside the longest subsequence of
 * `after` that's still in `before`'s order. One drag moves exactly one id; the
 * others only shifted to make room for it.
 */
export function movedIds(before: readonly string[], after: readonly string[]): string[] {
  const rank = new Map(before.map((id, index) => [id, index]));
  const ranks = after.map((id) => rank.get(id) ?? -1);

  // Longest increasing subsequence (patience sorting), keeping predecessors to
  // recover which positions are in it.
  const tails: number[] = [];
  const previous: number[] = Array.from({ length: ranks.length }, () => -1);
  for (let i = 0; i < ranks.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ranks[tails[mid]] < ranks[i]) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) previous[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const kept = new Set<number>();
  for (let i = tails.length > 0 ? tails[tails.length - 1] : -1; i >= 0; i = previous[i]) kept.add(i);

  return after.filter((_id, index) => !kept.has(index));
}
