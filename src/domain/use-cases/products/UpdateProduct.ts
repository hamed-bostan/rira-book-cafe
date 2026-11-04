import { diffFields } from "../../entities/ActivityEntry";
import { lendingCopies } from "../../entities/Product";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { reclaimImage } from "../images/reclaimImage";

import { productSnapshot } from "./productActivity";
import { requireCategory } from "./requireCategory";
import { validateProduct } from "./validateProduct";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { Product } from "../../entities/Product";
import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { ICategoryRepository } from "../../repositories/ICategoryRepository";
import type { IImageReferences } from "../../repositories/IImageReferences";
import type { IImageStorageRepository } from "../../repositories/IImageStorageRepository";
import type { IProductRepository, NewProduct } from "../../repositories/IProductRepository";

/**
 * Save a menu item's edit form. A book's copies to lend can't go below the copies
 * of it out on loan right now, and a book with copies out can't stop being one
 * (`COPIES_BELOW_ON_LOAN`) — those loans need a copy to come back to. A book
 * Inventory counts keeps its stock: only stock movements change it.
 */
export class UpdateProduct {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly loanRepo: Pick<IBookLoanRepository, "countOpenForBook">,
    private readonly categoryRepo: Pick<ICategoryRepository, "getById">,
    /**
     * Where a replaced picture is reclaimed from (see `reclaimImage`). Optional so a
     * caller that never swaps pictures needn't wire storage; the route always does.
     */
    private readonly images?: ProductImageCleanup,
  ) {}

  /** `actor` is the admin saving the form, and is required — it attributes the activity entry. */
  async execute(id: string, input: NewProduct, actor: ActivityActor): Promise<Product> {
    if (!id) throw new ValidationError("id", "Missing product id.");
    const valid = validateProduct(input);

    const existing = await this.productRepo.getById(id);
    if (!existing) throw new NotFoundError("product", id);
    await requireCategory(this.categoryRepo, valid.categoryId);

    const copies = valid.kind === "book" ? lendingCopies(valid.book) : 0;
    if (copies < (await this.loanRepo.countOpenForBook(id))) {
      throw new ConflictError(
        "COPIES_BELOW_ON_LOAN",
        "More copies of this book are out on loan than that. Copies to lend can't go below the number out.",
      );
    }

    // A book Inventory counts keeps one count of its copies, moved only by stock
    // movements and orders: whatever stock the form sent is left out of the write
    // rather than refused — the read-only field may simply be stale after a sale.
    const write = existing.inventoryTracked ? { ...valid, stockQuantity: undefined } : valid;

    // The entry is written by the repository inside the transaction that saves the
    // item, diffed against the row the write actually produced. Returning `null`
    // for an unchanged save keeps the log a record of changes rather than clicks.
    const updated = await this.productRepo.update(id, write, (saved) => {
      const changes = diffFields(productSnapshot(existing), productSnapshot(saved));
      if (changes.length === 0) return null;
      return {
        actorId: actor.id,
        actorName: actor.name,
        action: "product.updated",
        entityType: "product",
        entityId: saved.id,
        entityLabel: saved.name,
        changes,
      };
    });

    // The old picture goes once the item points at the new one — after the write
    // commits, best-effort, and only when nothing else (an order line that
    // snapshotted it, another item) still shows it.
    if (this.images && existing.imageUrl !== updated.imageUrl) {
      await reclaimImage(existing.imageUrl, this.images.references, this.images.storage);
    }
    return updated;
  }
}

/** What reclaiming an item's old picture needs: who still uses it, and the storage it's in. */
export type ProductImageCleanup = {
  references: IImageReferences;
  storage: Pick<IImageStorageRepository, "pathForUrl" | "removeByUrl">;
};
