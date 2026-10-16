import { singleChange } from "../../entities/ActivityEntry";
import { ValidationError } from "../../errors/ValidationError";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { Product } from "../../entities/Product";
import type { BulkProductChange, IProductRepository } from "../../repositories/IProductRepository";


/** How many products one bulk action may touch. */
const MAX_BULK_PRODUCTS = 200;

/**
 * Apply one field change across a selection of products — the catalog list's bulk
 * actions: publish, unpublish, and move to a category. Admin only.
 *
 * Deliberately narrow. It writes exactly the fields {@link BulkProductChange}
 * allows and nothing else, so it can never become a way to set a price or a stock
 * level on twenty products at once: stock has its own ledgered path (`AdjustStock`)
 * that this must not route around, and a price is not the kind of value anyone
 * means to make identical across a selection.
 *
 * The repository does the work in one transaction and writes one activity entry per
 * product — the action is `product.updated`, the same as a form save, because that
 * is what it is. Which field moved is the entry's diff, so "every time this product
 * was hidden" is answered by the indexed `?field=isPublished` filter rather than by
 * a separate action name.
 */
export class BulkUpdateProducts {
  constructor(private readonly productRepo: IProductRepository) {}

  /**
   * Returns the products the change actually altered. Ids that don't exist, and
   * products already holding the target value, are skipped — so the count can be
   * lower than `ids.length`, and that count is what the screen reports back.
   */
  async execute(
    ids: readonly string[],
    change: BulkProductChange,
    actor: ActivityActor,
  ): Promise<Product[]> {
    if (ids.length === 0) throw new ValidationError("ids", "Select at least one product.");
    // A bound rather than a paging scheme: the selection comes from a page of the
    // catalog list, so it's bounded by the page size in practice. The limit is here
    // to stop a hand-written request asking for a transaction over the whole table.
    if (ids.length > MAX_BULK_PRODUCTS) {
      throw new ValidationError("ids", `Select at most ${MAX_BULK_PRODUCTS} products.`);
    }
    if (change.field === "categoryId" && !change.value) {
      throw new ValidationError("categoryId", "Choose a category.");
    }

    const updates = await this.productRepo.applyBulkChange(ids, change, ({ product, previous }) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "product.updated",
      entityType: "product",
      entityId: product.id,
      entityLabel: product.name,
      // One field, so the diff is built directly rather than by diffing two
      // snapshots — `applyBulkChange` only ever moves the one it was given.
      changes: singleChange(change.field, previous[change.field], product[change.field]),
    }));

    return updates.map((update) => update.product);
  }
}
