import { activityValue } from "../../entities/ActivityEntry";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { reclaimImage } from "../images/reclaimImage";

import { productSnapshot } from "./productActivity";

import type { ProductImageCleanup } from "./UpdateProduct";
import type { ActivityActor } from "../../entities/ActivityEntry";
import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { IBookWaitlistRepository } from "../../repositories/IBookWaitlistRepository";
import type { IProductRepository } from "../../repositories/IProductRepository";

/**
 * Delete a menu item. A book still out on loan, or with guests in its line, can't
 * go (`BOOK_IN_USE`): those loans and holds would be left pointing at nothing —
 * close them first.
 */
export class DeleteProduct {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly loanRepo: Pick<IBookLoanRepository, "countOpenForBook">,
    private readonly waitlistRepo: Pick<IBookWaitlistRepository, "listOpenForBook">,
    /** Where the deleted item's picture is reclaimed from — see `UpdateProduct`. */
    private readonly images?: ProductImageCleanup,
  ) {}

  async execute(id: string, actor: ActivityActor): Promise<void> {
    if (!id) throw new ValidationError("id", "Missing product id.");

    const existing = await this.productRepo.getById(id);
    if (!existing) throw new NotFoundError("product", id);

    const [onLoan, line] = await Promise.all([
      this.loanRepo.countOpenForBook(id),
      this.waitlistRepo.listOpenForBook(id),
    ]);
    if (onLoan > 0 || line.length > 0) {
      throw new ConflictError(
        "BOOK_IN_USE",
        "This book is out on loan or has guests in line. Close those loans and holds before deleting it.",
      );
    }

    // The entry commits with the delete, which matters more here than anywhere
    // else: once this returns, the log is the *only* place the product's name,
    // price and level still exist. A window in which the row is gone and the entry
    // isn't yet written is a window in which that history can be lost outright.
    //
    // The hook takes no argument — a delete produces nothing to describe, and the
    // values it records are the ones read before the write.
    const snapshot = productSnapshot(existing);
    await this.productRepo.delete(id, () => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "product.deleted",
      entityType: "product",
      entityId: id,
      entityLabel: existing.name,
      // Every tracked field moving to nothing, rather than the empty diff a delete
      // would otherwise produce.
      changes: Object.entries(snapshot)
        .map(([field, value]) => ({ field, before: activityValue(value), after: null }))
        .filter((change) => change.before !== null),
    }));

    // Reclaim the picture once the row is gone (best-effort, never blocks the
    // delete). Kept when an order line still shows it — a sold item's receipts do.
    if (this.images) await reclaimImage(existing.imageUrl, this.images.references, this.images.storage);
  }
}
