import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { DeleteProduct } from "./DeleteProduct";
import type { ActivityActor } from "../../entities/ActivityEntry";
import type { IProductRepository } from "../../repositories/IProductRepository";

/** How many items one bulk delete may name — the same cap as the other bulk actions. */
export const MAX_BULK_DELETE_PRODUCTS = 200;

/** Why an item in a bulk delete was left in place. */
export const BULK_DELETE_REFUSALS = ["bookInUse", "notFound"] as const;
export type BulkDeleteRefusal = (typeof BULK_DELETE_REFUSALS)[number];

export type BulkDeleteResult = {
  /** How many items were deleted. */
  deleted: number;
  /** The ones left in place, each with why — so the screen can name them. */
  refused: { id: string; name: string; reason: BulkDeleteRefusal }[];
};

/**
 * Delete a selection of menu items — the list's bulk Delete, after a confirm.
 *
 * Each item goes through the single-item {@link DeleteProduct}, so every rule it
 * enforces (a book out on loan or with guests in line stays) and every side effect
 * it has (its own activity entry, committed with its delete; its picture
 * reclaimed) applies to each one exactly as to a row's own Delete. An item that
 * can't go is reported with its reason and the rest still go — a book on loan
 * doesn't block clearing out twenty retired drinks. Each delete is its own
 * transaction: one that fails unexpectedly stops the run, and those already done
 * stay done (each is complete, with its entry).
 */
export class DeleteProducts {
  constructor(
    private readonly productRepo: Pick<IProductRepository, "getByIds">,
    private readonly deleteOne: Pick<DeleteProduct, "execute">,
  ) {}

  async execute(ids: readonly string[], actor: ActivityActor): Promise<BulkDeleteResult> {
    if (ids.length === 0) throw new ValidationError("ids", "Select at least one item.");
    if (ids.length > MAX_BULK_DELETE_PRODUCTS) {
      throw new ValidationError("ids", `Select at most ${MAX_BULK_DELETE_PRODUCTS} items.`);
    }

    const unique = [...new Set(ids)];
    const names = new Map((await this.productRepo.getByIds(unique)).map((product) => [product.id, product.name]));
    const result: BulkDeleteResult = { deleted: 0, refused: [] };

    for (const id of unique) {
      try {
        await this.deleteOne.execute(id, actor);
        result.deleted++;
      } catch (error) {
        const reason = refusalOf(error);
        if (!reason) throw error;
        result.refused.push({ id, name: names.get(id) ?? "", reason });
      }
    }
    return result;
  }
}

/** The refusals a bulk delete reports and carries on past; anything else is a failure. */
function refusalOf(error: unknown): BulkDeleteRefusal | null {
  if (error instanceof ConflictError && error.code === "BOOK_IN_USE") return "bookInUse";
  if (error instanceof NotFoundError) return "notFound";
  return null;
}
