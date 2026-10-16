import { singleChange } from "../../entities/ActivityEntry";
import { ValidationError } from "../../errors/ValidationError";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { Category } from "../../entities/Category";
import type { BulkCategoryChange, ICategoryRepository } from "../../repositories/ICategoryRepository";


/** How many categories one bulk action may touch. */
const MAX_BULK_CATEGORIES = 200;

/**
 * Apply one field change across a selection of categories — the management
 * list's bulk actions: activate and deactivate. Admin only.
 *
 * Mirrors `BulkUpdateProducts`. No bulk delete: deleting a category is
 * destructive and rare enough to stay a per-row confirm, so `BulkCategoryChange`
 * has no variant for it — there's nothing here for a bulk endpoint to route
 * around.
 */
export class BulkUpdateCategories {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  /**
   * Returns the categories the change actually altered. Ids that don't exist,
   * and categories already holding the target value, are skipped — so the
   * count can be lower than `ids.length`, and that count is what the screen
   * reports back.
   */
  async execute(
    ids: readonly string[],
    change: BulkCategoryChange,
    actor: ActivityActor,
  ): Promise<Category[]> {
    if (ids.length === 0) throw new ValidationError("ids", "Select at least one category.");
    if (ids.length > MAX_BULK_CATEGORIES) {
      throw new ValidationError("ids", `Select at most ${MAX_BULK_CATEGORIES} categories.`);
    }

    const updates = await this.categoryRepo.applyBulkChange(ids, change, ({ category, previous }) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "category.updated",
      entityType: "category",
      entityId: category.id,
      entityLabel: category.name,
      changes: singleChange(change.field, previous[change.field], category[change.field]),
    }));

    return updates.map((update) => update.category);
  }
}
